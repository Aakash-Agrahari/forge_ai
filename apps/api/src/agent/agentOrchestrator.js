import {
    createAgentState,
    incrementIteration,
    addMessage,
    recordToolCall,
    recordFileChange,
    recordError,
    recordVerificationResult,
    recordExecutionResult,
    completeAgentState
} from "./agentState.js";

import { executeTool } from "./toolRegistery.js";
import { getAgentTools } from "./toolSchema.js";
import { createAgentModelRequest } from "./agentModelRequest.js";
import { normalizeAgentModelResult } from "./agentModel.js";
import { selectModelsForRequest } from "../llm/modelSelectionService.js";
import { executeWithFallback } from "../llm/fallbackExecutor.js";
import { createMessage } from "../services/messageService.js";
import { updateAgentRun } from "../services/agentRunService.js";
import { AGENT_SYSTEM_PROMPT } from "./agentSystemPrompt.js";
import { validateToolCall } from "./toolCallValidator.js";

const MAX_ITERATIONS = 10;
const MAX_IDENTICAL_TOOL_CALLS = 3;
const MAX_REPEATED_TOOL_RECOVERIES = 2;
const MAX_EARLY_COMPLETION_RETRIES = 2;

/*
 * ============================================================
 * TASK REQUIREMENTS
 * ============================================================
 */

function getTaskRequirements(messages) {
    const latestUserMessage = [...messages]
        .reverse()
        .find(
            (message) =>
                message.role === "user"
        );

    const userText = (
        latestUserMessage?.content ?? ""
    ).toLowerCase();

    const verificationKeywords = [
        "run test",
        "run tests",
        "run the test",
        "run the tests",
        "execute",
        "execution",
        "verify",
        "verification",
        "test again",
        "successful execution",
        "prove",
        "observe actual",
        "diagnose",
        "fix the bug",
        "fix incorrect"
    ];

    const requiresVerification =
        verificationKeywords.some(
            (keyword) =>
                userText.includes(keyword)
        );

    const repairKeywords = [
        "intentionally introduce",
        "intentionally make",
        "intentionally buggy",
        "introduce bug",
        "make it buggy",
        "buggy",
        "incorrect implementation",
        "fix the bug",
        "diagnose",
        "repair",
        "fix incorrect"
    ];

    const requiresFailureAndRepair =
        repairKeywords.some(
            (keyword) =>
                userText.includes(keyword)
        );

    return {
        requiresVerification,
        requiresFailureAndRepair
    };
}

/*
 * ============================================================
 * VERIFICATION HELPERS
 * ============================================================
 */

function hasSuccessfulVerification(toolResults) {
    return toolResults.some((result) => {
        if (!result?.success) {
            return false;
        }

        const toolName = result.toolName;

        if (
            toolName === "run_command" ||
            toolName === "execute_javascript" ||
            toolName === "run_javascript_test" ||
            toolName === "verify_javascript"
        ) {
            if (toolName === "run_javascript_test") {
                return result.passed === true;
            }

            if (toolName === "verify_javascript") {
                return result.verified === true;
            }

            return (
                result.exitCode === 0 ||
                result.success === true
            );
        }

        return false;
    });
}

function hasObservedExecutionFailure(toolResults) {
    return toolResults.some((result) => {
        if (!result) {
            return false;
        }

        const toolName = result.toolName;

        /*
         * run_javascript_test has an explicit passed field.
         */
        if (toolName === "run_javascript_test") {
            return result.passed === false;
        }

        /*
         * execute_javascript reports runtime failure using
         * success=false, non-zero exit code, timeout, etc.
         */
        if (toolName === "execute_javascript") {
            return (
                result.success === false ||
                result.exitCode !== 0 ||
                result.timeOut === true
            );
        }

        /*
         * run_command normally exposes success/exitCode.
         */
        if (toolName === "run_command") {
            return (
                result.success === false ||
                result.exitCode !== 0 ||
                result.timeOut === true
            );
        }

        /*
         * Some custom test runners may return exitCode=0 while
         * printing FAIL lines. Detect those as real failures too.
         */
        if (toolName === "run_javascript_test") {
            const stdout =
                typeof result.stdout === "string"
                    ? result.stdout
                    : "";

            return (
                stdout.includes("FAIL:") ||
                stdout.includes("FAIL ") ||
                stdout.includes("FAILED")
            );
        }

        return false;
    });
}

function hasSuccessfulVerificationAfterFailure(toolResults) {
    let failureObserved = false;

    for (const result of toolResults) {
        if (hasObservedExecutionFailure([result])) {
            failureObserved = true;
            continue;
        }

        if (
            failureObserved &&
            hasSuccessfulVerification([result])
        ) {
            return true;
        }
    }

    return false;
}

/*
 * ============================================================
 * DETERMINISTIC COMPLETION GUARD
 * ============================================================
 *
 * This is the important new protection.
 *
 * Once the user's requested verification workflow is actually
 * proven, the orchestrator stops immediately.
 *
 * The model does NOT get another chance to make an unnecessary
 * tool call such as:
 *
 *     cat /etc/os-release
 *
 * ============================================================
 */

function isCompletionReady(
    taskRequirements,
    toolResults
) {
    /*
     * Normal tasks without explicit verification requirements
     * can complete through the normal no-tool-call path.
     */
    if (!taskRequirements.requiresVerification) {
        return false;
    }

    /*
     * The task requires actual execution/testing/verification.
     * We must have successful evidence.
     */
    if (
        !hasSuccessfulVerification(toolResults)
    ) {
        return false;
    }

    /*
     * If the user explicitly requested a bug → failure →
     * diagnosis → repair → successful verification workflow,
     * we require both the observed failure and the later success.
     */
    if (
        taskRequirements.requiresFailureAndRepair
    ) {
        return hasSuccessfulVerificationAfterFailure(
            toolResults
        );
    }

    return true;
}

/*
 * ============================================================
 * JAVASCRIPT VERIFICATION FEEDBACK
 * ============================================================
 */

function getJavaScriptVerificationStatus(toolResult) {
    if (toolResult?.passed === true) {
        return {
            category: "PASSED",
            message:
                "JavaScript behavioral test passed. The actual function output matches the expected result. This is valid behavioral verification."
        };
    }

    const failureType =
        toolResult?.failureType ??
        toolResult?.failureCode ??
        toolResult?.code ??
        toolResult?.error?.code ??
        null;

    switch (failureType) {
        case "TEST_FAILURE":
        case "BEHAVIOR_MISMATCH":
            return {
                category: "REPAIR_REQUIRED",
                message:
                    "JavaScript behavioral test failed. The actual function behavior did not match the expected result. Inspect the test output and relevant implementation, diagnose the root cause, repair the incorrect code, and run run_javascript_test again."
            };

        case "TEST_SETUP_FAILURE":
        case "FUNCTION_NOT_FOUND":
        case "MODULE_IMPORT_FAILED":
            return {
                category: "TEST_SETUP_ERROR",
                message:
                    "JavaScript behavioral verification could not be completed because of a test setup or module/function discovery problem. This is not evidence that the implementation is incorrect. Do not blindly modify the application code. Inspect the function name, exports, module format, imports, and test configuration first."
            };

        case "FUNCTION_EXECUTION_FAILED":
        case "RUNTIME_FAILURE":
            return {
                category: "REPAIR_REQUIRED",
                message:
                    "JavaScript behavioral verification failed because the target function threw a runtime error. Inspect the reported error, diagnose the root cause, repair the relevant code if necessary, and run run_javascript_test again."
            };

        case "TEST_TIMEOUT":
        case "TIMEOUT":
            return {
                category: "EXECUTION_PROBLEM",
                message:
                    "JavaScript behavioral verification timed out. Inspect the function for an execution or infinite-loop problem and use the test result to determine whether code repair is required."
            };

        case "SANDBOX_FAILURE":
            return {
                category: "EXECUTION_PROBLEM",
                message:
                    "JavaScript behavioral verification could not complete because the sandbox failed. This does not by itself prove that the application code is incorrect. Inspect the sandbox error before modifying the implementation."
            };

        default:
            return {
                category: "VERIFICATION_ERROR",
                message:
                    "JavaScript behavioral verification did not pass. Inspect the complete test result and determine whether the failure is an implementation problem, execution problem, or test setup problem. Do not modify correct application code solely to satisfy a broken test."
            };
    }
}

/*
 * ============================================================
 * AGENT
 * ============================================================
 */

export async function runAgent({
    runId,
    projectId,
    conversationId,
    messages
}) {
    const state = createAgentState({
        runId,
        projectId,
        conversationId
    });

    const toolCallHistory = new Map();
    const toolResults = [];

    let earlyCompletionRetries = 0;
    let repeatedToolRecoveries = 0;
    let hasPerformedWork = false;

    const taskRequirements =
        getTaskRequirements(messages);

    addMessage(state, {
        role: "system",
        content: AGENT_SYSTEM_PROMPT
    });

    /*
     * Give the model explicit awareness of the current task
     * requirements.
     */
    addMessage(state, {
        role: "system",
        content: [
            "ACTIVE TASK EXECUTION CONTEXT",
            "",
            "You are executing ONLY the latest user request.",
            "Previous conversation tasks are historical context and are NOT active instructions.",
            "Do not continue, repair, verify, or repeat work from an older task unless the latest user request explicitly asks for it.",
            "",
            `Requires verification: ${taskRequirements.requiresVerification}`,
            `Requires failure-and-repair workflow: ${taskRequirements.requiresFailureAndRepair}`,
            "",
            "Treat the current project files as the source of truth for existing project state.",
            "Inspect the project when necessary instead of relying on previous tool results.",
            "Do not claim completion from source inspection alone.",
            "When actual execution is required, use actual execution evidence.",
            "Once the required verification succeeds, stop working."
        ].join("\n")
    });

    try {
        /*
         * Messages already exist in the database.
         * Load them into the in-memory agent state,
         * but do not persist them again.
         */
        const latestUserMessage = [...messages]
            .reverse()
            .find((message) => message.role === "user");

        if (!latestUserMessage) {
            const error = new Error(
                "No active user task was found"
            );

            error.code =
                "ACTIVE_TASK_NOT_FOUND";

            error.statusCode = 400;

            throw error;
        }

        addMessage(state, {
            role: "user",
            content:
                latestUserMessage.content ?? ""
        });

        await updateAgentRun({
            runId,
            conversationId,
            data: {
                status: "running"
            }
        });

        const tools = getAgentTools();

        const models = selectModelsForRequest({
            task: "code",
            freeOnly: true,
            toolCalling: true
        });

        if (models.length === 0) {
            const error = new Error(
                "No eligible tool-calling models available"
            );

            error.code = "NO_TOOL_CALLING_MODELS";
            error.statusCode = 503;

            throw error;
        }

        while (
            state.iteration < MAX_ITERATIONS
        ) {
            incrementIteration(state);

            const request =
                createAgentModelRequest({
                    messages: state.messages,
                    tools,
                    toolChoice: "auto",
                    temperature: 0.2,
                    maxTokens: 8192
                });

            const rawResult =
                await executeWithFallback({
                    models,
                    messages: request.messages,
                    tools: request.tools,
                    toolChoice: request.toolChoice,
                    temperature: request.temperature,
                    maxTokens: request.maxTokens
                });

            const result =
                normalizeAgentModelResult(
                    rawResult
                );

            console.log(
                `[ForgeAI Agent] Iteration ${state.iteration}`,
                JSON.stringify(
                    {
                        provider:
                            result.provider,
                        model:
                            result.model,
                        content:
                            result.content,
                        toolCalls:
                            result.toolCalls
                    },
                    null,
                    2
                )
            );

            addMessage(state, {
                role: "assistant",
                content: result.content,
                toolCalls: result.toolCalls,
                provider: result.provider,
                model: result.model
            });

            /*
             * ====================================================
             * MODEL WANTS TO FINISH WITHOUT A TOOL CALL
             * ====================================================
             */

            if (
                !result.toolCalls ||
                result.toolCalls.length === 0
            ) {
                const verificationPassed =
                    !taskRequirements.requiresVerification ||
                    isCompletionReady(
                        taskRequirements,
                        toolResults
                    );

                /*
                * ====================================================
                * REQUIRED VERIFICATION — FAIL CLOSED
                * ====================================================
                *
                * If the user explicitly requested execution,
                * testing, or verification, the agent MUST NOT
                * complete until successful evidence exists.
                *
                * There is intentionally NO retry-limit escape
                * here. Reaching MAX_EARLY_COMPLETION_RETRIES
                * must never turn an incomplete task into success.
                */
                if (
                    taskRequirements.requiresVerification &&
                    !verificationPassed
                ) {
                    earlyCompletionRetries += 1;

                    const continuationMessage = [
                        "You attempted to finish the task before completing it.",
                        "Do not claim success.",
                        "",
                        "The user's latest request explicitly requires actual execution/testing/verification.",
                        "Successful execution evidence has NOT been established.",
                        "",
                        "Continue working with the available tools.",
                        "If execution failed because of the sandbox, inspect and resolve the execution problem.",
                        "If the implementation is incomplete, complete it.",
                        "If a test failed because of the implementation, diagnose and repair it.",
                        "Do not treat file creation or source inspection as runtime verification.",
                        "",
                        `Premature completion attempt: ${earlyCompletionRetries}.`
                    ].join("\n");

                    addMessage(state, {
                        role: "system",
                        content: continuationMessage
                    });

                    console.log(
                        "[ForgeAI Agent] Blocked completion: required verification has not passed."
                    );

                    continue;
                }

                /*
                * Tasks without explicit verification requirements
                * may complete through the normal model completion path.
                */
                await createMessage({
                    conversationId,
                    role: "assistant",
                    content:
                        result.content ?? ""
                });

                completeAgentState(
                    state,
                    "completed"
                );

                await updateAgentRun({
                    runId,
                    conversationId,
                    data: {
                        status: "completed",
                        provider:
                            result.provider,
                        model:
                            result.model,
                        completedAt:
                            new Date()
                    }
                });

                return {
                    state,
                    result
                };
            }

            /*
             * ====================================================
             * PERSIST MODEL TOOL CALLS
             * ====================================================
             */

            for (const toolCall of result.toolCalls) {
                await createMessage({
                    conversationId,
                    role: "assistant",
                    content:
                        result.content ?? "",
                    toolCallId:
                        toolCall.id,
                    toolName:
                        toolCall.name,
                    toolArguments:
                        toolCall.arguments
                });
            }

            /*
             * ====================================================
             * EXECUTE TOOLS
             * ====================================================
             */

            for (const toolCall of result.toolCalls) {
                /*
                 * Validate the model-generated tool call
                 * before executing anything.
                 */
                const validatedToolCall =
                    validateToolCall(
                        toolCall
                    );

                const toolCallKey =
                    JSON.stringify({
                        name:
                            validatedToolCall.name,
                        arguments:
                            validatedToolCall.arguments
                    });

                const previousCount =
                    toolCallHistory.get(
                        toolCallKey
                    ) ?? 0;

                const currentCount =
                    previousCount + 1;

                toolCallHistory.set(
                    toolCallKey,
                    currentCount
                );

                /*
                 * Prevent the model from endlessly repeating
                 * exactly the same operation.
                 */
                /*
                * ============================================================
                * REPEATED TOOL CALL RECOVERY
                * ============================================================
                *
                * Do not immediately fail the entire agent when the model
                * repeats an identical tool call.
                *
                * A repeated call usually means the model has lost track of
                * the current project state or has failed to transition from
                * "write" -> "inspect" -> "verify".
                *
                * Block the duplicate call and give the model an explicit
                * recovery instruction.
                *
                * A hard recovery limit still exists so a genuinely stuck
                * model cannot loop forever.
                * ============================================================
                */

                if (
                    currentCount >
                    MAX_IDENTICAL_TOOL_CALLS
                ) {
                    repeatedToolRecoveries += 1;

                    console.warn(
                        `[ForgeAI Agent] Blocked repeated tool call: ${validatedToolCall.name}`,
                        {
                            currentCount,
                            recoveryAttempt:
                                repeatedToolRecoveries
                        }
                    );

                    if (
                        repeatedToolRecoveries >
                        MAX_REPEATED_TOOL_RECOVERIES
                    ) {
                        const error = new Error(
                            `Agent could not recover from repeated tool call: ${validatedToolCall.name}`
                        );

                        error.code =
                            "REPEATED_TOOL_CALL_RECOVERY_FAILED";

                        error.statusCode = 503;

                        throw error;
                    }

                    const recoveryMessage = [
                        "REPEATED TOOL CALL DETECTED.",
                        "",
                        `You attempted to call "${validatedToolCall.name}" with the exact same arguments multiple times.`,
                        "That operation has already been attempted and must NOT be repeated unchanged.",
                        "",
                        "STOP repeating the same tool call.",
                        "",
                        "Inspect the current project state and continue from the result of the previous operation.",
                        "",
                        "If you just created or modified a file:",
                        "1. Read the file using read_file.",
                        "2. Inspect the actual contents.",
                        "3. Run the appropriate execution or verification tool.",
                        "4. Inspect the actual error or result.",
                        "5. Repair the implementation only if the evidence requires a repair.",
                        "6. Run the verification again.",
                        "",
                        "For a JavaScript task requiring behavioral verification, use run_javascript_test.",
                        "Do not claim completion from write_file success or source inspection alone.",
                        "",
                        `Recovery attempt: ${repeatedToolRecoveries}/${MAX_REPEATED_TOOL_RECOVERIES}`
                    ].join("\n");

                    addMessage(state, {
                        role: "system",
                        content: recoveryMessage
                    });

                    /*
                    * Do not execute the duplicate tool call.
                    * Move directly to the next model iteration so the model
                    * can choose a different corrective action.
                    */
                    continue;
                }

                recordToolCall(state, {
                    id: validatedToolCall.id,
                    name:
                        validatedToolCall.name,
                    input:
                        validatedToolCall.arguments,
                    iteration:
                        state.iteration
                });

                let toolResult;

                try {
                    toolResult =
                        await executeTool(
                            validatedToolCall.name,
                            validatedToolCall.arguments,
                            {
                                projectId,
                                conversationId,
                                runId
                            }
                        );
                } catch (toolError) {
                    toolResult = {
                        success: false,
                        error: {
                            code:
                                toolError.code ??
                                "TOOL_EXECUTION_ERROR",
                            message:
                                toolError.message ??
                                "Tool execution failed"
                        }
                    };

                    recordError(
                        state,
                        toolError
                    );
                }

                /*
                 * =================================================
                 * VERIFICATION / EXECUTION FEEDBACK
                 * =================================================
                 */

                if (
                    validatedToolCall.name ===
                    "run_javascript_test"
                ) {
                    const verification =
                        getJavaScriptVerificationStatus(
                            toolResult
                        );

                    addMessage(state, {
                        role: "system",
                        content:
                            verification.message
                    });

                    console.log(
                        "[ForgeAI Agent] JavaScript verification:",
                        JSON.stringify(
                            {
                                category:
                                    verification.category,
                                failureCode:
                                    toolResult?.failureCode ??
                                    toolResult?.code ??
                                    toolResult?.error
                                        ?.code ??
                                    null,
                                passed:
                                    toolResult?.passed ===
                                    true
                            },
                            null,
                            2
                        )
                    );
                } else if (
                    validatedToolCall.name ===
                    "verify_javascript"
                ) {
                    const verificationPassed =
                        toolResult?.verified ===
                        true;

                    const verificationStatus =
                        verificationPassed
                            ? "JavaScript structural verification passed."
                            : "JavaScript structural verification failed. Inspect the verification result and repair the file if necessary.";

                    addMessage(state, {
                        role: "system",
                        content:
                            verificationStatus
                    });

                    console.log(
                        "[ForgeAI Agent] Verification status:",
                        verificationStatus
                    );
                }

                console.log(
                    `[ForgeAI Agent] Tool result: ${validatedToolCall.name}`,
                    JSON.stringify(
                        toolResult,
                        null,
                        2
                    )
                );

                /*
                 * =================================================
                 * TRACK FILE CHANGES
                 * =================================================
                 */

                if (
                    validatedToolCall.name ===
                        "write_file" &&
                    toolResult?.success &&
                    toolResult?.file?.path
                ) {
                    recordFileChange(
                        state,
                        toolResult.file.path
                    );
                }

                /*
                 * =================================================
                 * TRACK VERIFICATION RESULTS
                 * =================================================
                 */

                if (
                    validatedToolCall.name ===
                        "verify_javascript" ||
                    validatedToolCall.name ===
                        "run_javascript_test"
                ) {
                    recordVerificationResult(
                        state,
                        toolResult
                    );
                }

                /*
                 * =================================================
                 * TRACK JAVASCRIPT EXECUTION
                 * =================================================
                 */

                if (
                    validatedToolCall.name ===
                    "execute_javascript"
                ) {
                    recordExecutionResult(
                        state,
                        toolResult
                    );

                    const executionStatus =
                        toolResult?.success &&
                        toolResult?.exitCode === 0 &&
                        !toolResult?.timeOut
                            ? "JavaScript execution succeeded. The program ran successfully."
                            : "JavaScript execution failed. Inspect stdout and stderr, determine the cause, repair the relevant file, and execute it again.";

                    addMessage(state, {
                        role: "system",
                        content:
                            executionStatus
                    });

                    console.log(
                        "[ForgeAI Agent] Execution status:",
                        executionStatus
                    );
                }

                /*
                 * =================================================
                 * STORE TOOL RESULT
                 * =================================================
                 */

                toolResults.push({
                    toolName:
                        validatedToolCall.name,
                    ...toolResult
                });

                if (toolResult?.success) {
                    hasPerformedWork = true;
                }

                /*
                 * =================================================
                 * 🔥 DETERMINISTIC COMPLETION GUARD
                 * =================================================
                 *
                 * IMPORTANT:
                 *
                 * This check happens immediately after receiving
                 * the tool result.
                 *
                 * If the user's required workflow is now complete,
                 * we DO NOT ask the model for another iteration.
                 *
                 * This prevents unnecessary calls such as:
                 *
                 *     cat /etc/os-release
                 *
                 * after the actual task already succeeded.
                 * =================================================
                 */

                function isCompletionReady(
                    taskRequirements,
                    toolResults
                ) {
                    // Tasks without explicit verification requirements
                    // can use the normal completion path.
                    if (!taskRequirements.requiresVerification) {
                        return false;
                    }

                    // A successful verification is always required.
                    if (!hasSuccessfulVerification(toolResults)) {
                        return false;
                    }

                    /*
                    * If ANY execution/verification failure was observed,
                    * the agent must prove that verification succeeded AFTER
                    * that failure.
                    *
                    * This makes the rule deterministic even if the natural-
                    * language task parser misses a repair keyword.
                    */
                    if (hasObservedExecutionFailure(toolResults)) {
                        return hasSuccessfulVerificationAfterFailure(
                            toolResults
                        );
                    }

                    /*
                    * If the user explicitly requested a failure -> repair ->
                    * verification workflow, require that sequence as well.
                    */
                    if (
                        taskRequirements.requiresFailureAndRepair
                    ) {
                        return hasSuccessfulVerificationAfterFailure(
                            toolResults
                        );
                    }

                    return true;
                }

                /*
                 * =================================================
                 * PERSIST TOOL RESULT
                 * =================================================
                 */

                const serializedToolResult =
                    JSON.stringify(
                        toolResult
                    );

                await createMessage({
                    conversationId,
                    role: "tool",
                    content:
                        serializedToolResult,
                    toolCallId:
                        validatedToolCall.id,
                    toolName:
                        validatedToolCall.name,
                    toolResult
                });

                /*
                 * Add the tool result back into the agent's
                 * in-memory conversation so the next model
                 * iteration can reason over it.
                 */
                addMessage(state, {
                    role: "tool",
                    toolCallId:
                        validatedToolCall.id,
                    toolName:
                        validatedToolCall.name,
                    content:
                        serializedToolResult
                });

                /*
                 * =================================================
                 * EXPLICIT TOOL STATUS FOR THE MODEL
                 * =================================================
                 */

                let toolStatus;

                if (
                    validatedToolCall.name ===
                    "run_javascript_test"
                ) {
                    const verification =
                        getJavaScriptVerificationStatus(
                            toolResult
                        );

                    toolStatus =
                        verification.message;
                } else if (
                    validatedToolCall.name ===
                    "verify_javascript"
                ) {
                    toolStatus =
                        toolResult?.verified
                            ? "JavaScript structural verification passed. This confirms the expected structure was found, but it does not prove runtime behavior."
                            : "JavaScript structural verification failed. Inspect the verification result, repair the relevant file, and run verification again.";
                } else {
                    toolStatus =
                        toolResult?.success
                            ? `Tool "${validatedToolCall.name}" completed successfully. Use this result as evidence. Do not repeat the same tool call unless the project state has changed or additional information is required.`
                            : `Tool "${validatedToolCall.name}" failed. Inspect the returned error, determine the cause, and take a different corrective action if possible.`;
                }

                addMessage(state, {
                    role: "system",
                    content: toolStatus
                });
            }
        }

        /*
         * ========================================================
         * MAX ITERATION SAFETY LIMIT
         * ========================================================
         */

        const error = new Error(
            `Agent exceeded maximum iterations (${MAX_ITERATIONS})`
        );

        error.code =
            "MAX_AGENT_ITERATIONS";

        error.statusCode = 503;

        throw error;
    } catch (error) {
        recordError(state, error);

        completeAgentState(
            state,
            "failed"
        );

        await updateAgentRun({
            runId,
            conversationId,
            data: {
                status: "failed",
                error: error.message,
                completedAt: new Date()
            }
        });

        throw error;
    }
}