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
const MAX_COMPLETION_RETRIES = 3;


/*
 * ============================================================
 * TASK CONTEXT
 * ============================================================
 *
 * The agent may receive short follow-up messages such as:
 *
 * "continue"
 * "re-read the conversation"
 *
 * Those messages should NOT replace the original coding task.
 *
 * We therefore identify the latest substantive user request
 * and keep it available throughout the agent run.
 */
function getTaskContext(messages) {
    const userMessages = messages
        .filter((message) => message.role === "user")
        .map((message) => (message.content ?? "").trim())
        .filter(Boolean);

    if (userMessages.length === 0) {
        return "";
    }

    const metaOnlyPatterns = [
        /^so have re read the conversation[.!]?$/i,
        /^re[- ]?read the conversation[.!]?$/i,
        /^read the conversation again[.!]?$/i,
        /^continue[.!]?$/i
    ];

    const candidates = userMessages.filter(
        (message) =>
            message.length >= 40 &&
            !metaOnlyPatterns.some((pattern) =>
                pattern.test(message)
            )
    );

    if (candidates.length === 0) {
        return userMessages[userMessages.length - 1];
    }

    return candidates[candidates.length - 1];
}


/*
 * ============================================================
 * TASK REQUIREMENTS
 * ============================================================
 *
 * Detect whether the user explicitly requires:
 *
 * 1. Runtime/test verification
 * 2. An intentional failure followed by repair
 *
 * Example:
 *
 * "Intentionally introduce a bug.
 * Run the test.
 * Observe failure.
 * Diagnose.
 * Fix.
 * Run again."
 *
 * For this type of task, a single successful test is NOT enough.
 */
function getTaskRequirements(taskText) {
    const text = taskText.toLowerCase();

    const requiresVerification = [
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
    ].some((keyword) =>
        text.includes(keyword)
    );

    const requiresObservedFailure = [
        "intentionally introduce",
        "intentionally make",
        "introduce a bug",
        "make it buggy",
        "make the implementation incorrect",
        "observe failure",
        "observe the failure",
        "observe actual failure",
        "diagnose root cause",
        "diagnose the root cause",
        "fix the bug",
        "fix incorrect implementation"
    ].some((keyword) =>
        text.includes(keyword)
    );

    return {
        requiresVerification,
        requiresObservedFailure
    };
}


/*
 * ============================================================
 * SUCCESSFUL VERIFICATION
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


/*
 * ============================================================
 * OBSERVED EXECUTION FAILURE
 * ============================================================
 *
 * This is intentionally different from a successful verification.
 *
 * For an intentional-bug workflow we need actual evidence that
 * the buggy implementation failed at runtime/test time.
 */
function hasObservedExecutionFailure(toolResults) {
    return toolResults.some((result) => {
        const toolName = result?.toolName;

        if (toolName === "run_javascript_test") {
            return result.passed === false;
        }

        if (
            toolName === "run_command" ||
            toolName === "execute_javascript"
        ) {
            return (
                result.success === false ||
                (
                    result.exitCode !== undefined &&
                    result.exitCode !== 0
                ) ||
                result.timeOut === true
            );
        }

        return false;
    });
}


/*
 * ============================================================
 * SUCCESS AFTER FAILURE
 * ============================================================
 *
 * For intentional repair tasks we require:
 *
 * failure
 *   ↓
 * repair
 *   ↓
 * success
 *
 * A success that happened BEFORE the failure does not count.
 */
function hasSuccessfulVerificationAfterFailure(toolResults) {
    let failureSeen = false;

    for (const result of toolResults) {
        if (hasObservedExecutionFailure([result])) {
            failureSeen = true;
            continue;
        }

        if (
            failureSeen &&
            hasSuccessfulVerification([result])
        ) {
            return true;
        }
    }

    return false;
}


/*
 * ============================================================
 * COMPLETION AUDIT
 * ============================================================
 *
 * Determines exactly what evidence is still missing.
 */
function getMissingCompletionRequirements(
    taskRequirements,
    toolResults
) {
    const missing = [];

    if (!taskRequirements.requiresVerification) {
        return missing;
    }

    /*
     * Tasks such as:
     *
     * "Introduce a bug, run it, observe failure,
     * fix it, and run it again."
     *
     * require BOTH failure and later success.
     */
    if (taskRequirements.requiresObservedFailure) {
        if (!hasObservedExecutionFailure(toolResults)) {
            missing.push(
                "an actual failing execution/test that demonstrates the bug or failure"
            );
        }

        if (
            !hasSuccessfulVerificationAfterFailure(
                toolResults
            )
        ) {
            missing.push(
                "a successful execution/test after the failure has been diagnosed and repaired"
            );
        }

        return missing;
    }

    /*
     * Normal verification task:
     *
     * successful runtime/test evidence is enough.
     */
    if (!hasSuccessfulVerification(toolResults)) {
        missing.push(
            "successful runtime/test verification of the requested final behavior"
        );
    }

    return missing;
}


/*
 * ============================================================
 * JAVASCRIPT TEST FEEDBACK
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

    const failureCode =
        toolResult?.failureCode ??
        toolResult?.code ??
        toolResult?.error?.code ??
        null;

    switch (failureCode) {
        case "BEHAVIOR_MISMATCH":
            return {
                category: "REPAIR_REQUIRED",
                message:
                    "JavaScript behavioral verification failed because the actual function output does not match the expected result. Inspect the implementation, repair the relevant code, and run run_javascript_test again."
            };

        case "FUNCTION_EXECUTION_FAILED":
            return {
                category: "REPAIR_REQUIRED",
                message:
                    "JavaScript behavioral verification could not execute the target function successfully. Inspect the reported runtime error, repair the relevant code if necessary, and run run_javascript_test again."
            };

        case "FUNCTION_NOT_FOUND":
            return {
                category: "TEST_SETUP_ERROR",
                message:
                    "JavaScript behavioral verification could not find the requested function. This is a test setup or function-discovery problem, not evidence that the implementation is incorrect. Do not blindly modify the implementation to make the test pass. Inspect the function name, export/setup, and test configuration first."
            };

        case "MODULE_IMPORT_FAILED":
            return {
                category: "TEST_SETUP_ERROR",
                message:
                    "JavaScript behavioral verification could not import the target module. This is a module/import configuration problem, not evidence that the function's behavior is incorrect. Inspect the module format, imports, and project configuration before modifying the implementation."
            };

        case "TEST_TIMEOUT":
            return {
                category: "EXECUTION_PROBLEM",
                message:
                    "JavaScript behavioral verification timed out. Inspect the function for an execution or infinite-loop problem and use the test result to determine whether code repair is required."
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
 * MAIN AGENT
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

    /*
     * Every tool result is stored here so that completion
     * decisions are based on actual runtime evidence.
     */
    const toolResults = [];

    let completionRetries = 0;

    /*
     * Identify the actual substantive task.
     */
    const taskContext = getTaskContext(messages);

    const taskRequirements =
        getTaskRequirements(taskContext);


    /*
     * System instructions.
     */
    addMessage(state, {
        role: "system",
        content: AGENT_SYSTEM_PROMPT
    });


    try {
        /*
         * ========================================================
         * LOAD EXISTING CONVERSATION
         * ========================================================
         *
         * Messages already exist in the database.
         * Load them into the in-memory agent state,
         * but do not persist them again.
         */
        for (const message of messages) {
            addMessage(state, {
                role: message.role,
                content: message.content ?? "",
                toolCallId: message.toolCallId ?? null,
                toolName: message.toolName ?? null,
                toolArguments:
                    message.toolArguments ?? null,
                toolResult:
                    message.toolResult ?? null
            });
        }


        /*
         * ========================================================
         * ACTIVE TASK CONTEXT
         * ========================================================
         *
         * This prevents short follow-up messages such as:
         *
         * "re-read the conversation"
         *
         * from replacing the actual coding task.
         */
        if (taskContext) {
            addMessage(state, {
                role: "system",
                content: [
                    "CURRENT TASK CONTEXT",
                    "",
                    "The following is the substantive user task for this agent run.",
                    "Treat it as the active task even if later user messages are only follow-up/meta instructions.",
                    "",
                    taskContext,
                    "",
                    "Do not confuse historical project state with completion of this task.",
                    "If the requested workflow includes intentional failure, diagnosis, repair, and final verification, complete that workflow in order."
                ].join("\n")
            });
        }


        /*
         * ========================================================
         * MARK RUNNING
         * ========================================================
         */
        await updateAgentRun({
            runId,
            conversationId,
            data: {
                status: "running"
            }
        });


        /*
         * ========================================================
         * LOAD TOOLS
         * ========================================================
         */
        const tools = getAgentTools();


        /*
         * ========================================================
         * SELECT FREE TOOL-CALLING MODELS
         * ========================================================
         */
        const models = selectModelsForRequest({
            task: "code",
            freeOnly: true,
            toolCalling: true
        });

        if (models.length === 0) {
            const error = new Error(
                "No eligible tool-calling models available"
            );

            error.code =
                "NO_TOOL_CALLING_MODELS";

            error.statusCode = 503;

            throw error;
        }


        /*
         * ========================================================
         * AGENT LOOP
         * ========================================================
         */
        while (
            state.iteration < MAX_ITERATIONS
        ) {
            incrementIteration(state);


            /*
             * ----------------------------------------------------
             * CREATE MODEL REQUEST
             * ----------------------------------------------------
             */
            const request =
                createAgentModelRequest({
                    messages: state.messages,
                    tools,
                    toolChoice: "auto",
                    temperature: 0.2,
                    maxTokens: 8192
                });


            /*
             * ----------------------------------------------------
             * EXECUTE MODEL WITH FALLBACK
             * ----------------------------------------------------
             */
            const rawResult =
                await executeWithFallback({
                    models,
                    messages: request.messages,
                    tools: request.tools,
                    toolChoice:
                        request.toolChoice,
                    temperature:
                        request.temperature,
                    maxTokens:
                        request.maxTokens
                });


            /*
             * ----------------------------------------------------
             * NORMALIZE RESULT
             * ----------------------------------------------------
             */
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


            /*
             * ----------------------------------------------------
             * STORE ASSISTANT RESPONSE IN MEMORY
             * ----------------------------------------------------
             */
            addMessage(state, {
                role: "assistant",
                content: result.content,
                toolCalls: result.toolCalls,
                provider:
                    result.provider,
                model:
                    result.model
            });


            /*
             * ====================================================
             * NO TOOL CALLS
             * ====================================================
             *
             * This is where we decide whether the agent is
             * genuinely finished.
             */
            if (
                !result.toolCalls ||
                result.toolCalls.length === 0
            ) {
                const missingRequirements =
                    getMissingCompletionRequirements(
                        taskRequirements,
                        toolResults
                    );


                /*
                 * ------------------------------------------------
                 * TASK IS NOT PROVEN COMPLETE
                 * ------------------------------------------------
                 */
                if (
                    missingRequirements.length > 0
                ) {
                    /*
                     * Prevent infinite continuation loops.
                     */
                    if (
                        completionRetries >=
                        MAX_COMPLETION_RETRIES
                    ) {
                        const error =
                            new Error(
                                [
                                    "Agent could not complete the requested task within the available iterations.",
                                    "Missing completion evidence:",
                                    ...missingRequirements.map(
                                        (item) =>
                                            `- ${item}`
                                    )
                                ].join("\n")
                            );

                        error.code =
                            "INCOMPLETE_AGENT_TASK";

                        error.statusCode = 503;

                        throw error;
                    }


                    completionRetries += 1;


                    /*
                     * ------------------------------------------------
                     * FORCE THE MODEL BACK INTO THE TASK
                     * ------------------------------------------------
                     */
                    const continuationMessage = [
                        "TASK COMPLETION AUDIT",
                        "",
                        "Do not finish the task yet.",
                        "Your last response contained no tool calls, but the user's requested workflow is not fully proven.",
                        "",
                        "ACTIVE USER TASK:",
                        taskContext ||
                            "Use the user's current request as the active task.",
                        "",
                        "MISSING COMPLETION EVIDENCE:",
                        ...missingRequirements.map(
                            (item) =>
                                `- ${item}`
                        ),
                        "",
                        "Continue using the appropriate tools.",
                        "Inspect the current project state if necessary.",
                        "Do not claim success from source inspection alone.",
                        "If the task requires a failure/repair workflow, you must first produce an actual failing execution, diagnose it, repair the relevant code, and then produce a successful execution/test.",
                        "",
                        `Completion audit attempt ${completionRetries}/${MAX_COMPLETION_RETRIES}.`
                    ].join("\n");


                    addMessage(state, {
                        role: "system",
                        content:
                            continuationMessage
                    });


                    console.log(
                        `[ForgeAI Agent] Completion audit required (${completionRetries}/${MAX_COMPLETION_RETRIES})`,
                        JSON.stringify(
                            {
                                missingRequirements,
                                taskRequirements
                            },
                            null,
                            2
                        )
                    );


                    continue;
                }


                /*
                 * ------------------------------------------------
                 * TASK IS PROVEN COMPLETE
                 * ------------------------------------------------
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
                        status:
                            "completed",
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
             * PERSIST ASSISTANT TOOL CALLS
             * ====================================================
             */
            for (
                const toolCall
                of result.toolCalls
            ) {
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
             * EXECUTE TOOL CALLS
             * ====================================================
             */
            for (
                const toolCall
                of result.toolCalls
            ) {
                /*
                 * Validate model-generated tool call.
                 */
                const validatedToolCall =
                    validateToolCall(
                        toolCall
                    );


                /*
                 * Create a deterministic key so we can
                 * detect endless identical operations.
                 */
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
                 * Prevent endless repetition.
                 */
                if (
                    currentCount >
                    MAX_IDENTICAL_TOOL_CALLS
                ) {
                    const error =
                        new Error(
                            `Agent repeated the same tool call too many times: ${validatedToolCall.name}`
                        );

                    error.code =
                        "REPEATED_TOOL_CALL";

                    error.statusCode = 503;

                    throw error;
                }


                /*
                 * Record tool call in agent state.
                 */
                recordToolCall(state, {
                    id:
                        validatedToolCall.id,
                    name:
                        validatedToolCall.name,
                    input:
                        validatedToolCall.arguments,
                    iteration:
                        state.iteration
                });


                let toolResult;


                /*
                 * ------------------------------------------------
                 * EXECUTE TOOL
                 * ------------------------------------------------
                 */
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
                } catch (
                    toolError
                ) {
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
                                    toolResult?.error?.code ??
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


                /*
                 * Log complete tool result.
                 */
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
                 * TRACK VERIFICATION
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
                 * STORE RESULT FOR COMPLETION AUDIT
                 * =================================================
                 */
                toolResults.push({
                    toolName:
                        validatedToolCall.name,
                    ...toolResult
                });


                const serializedToolResult =
                    JSON.stringify(
                        toolResult
                    );


                /*
                 * =================================================
                 * PERSIST TOOL RESULT
                 * =================================================
                 */
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
                 * =================================================
                 * ADD TOOL RESULT TO MODEL CONTEXT
                 * =================================================
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
                 * EXPLICIT TOOL STATUS
                 * =================================================
                 *
                 * This gives the model a concise interpretation
                 * of what just happened.
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
                    content:
                        toolStatus
                });
            }
        }


        /*
         * ========================================================
         * MAX ITERATIONS
         * ========================================================
         */
        const error =
            new Error(
                `Agent exceeded maximum iterations (${MAX_ITERATIONS})`
            );


        error.code =
            "MAX_AGENT_ITERATIONS";

        error.statusCode = 503;

        throw error;


    } catch (error) {
        /*
         * ========================================================
         * FAILED RUN
         * ========================================================
         */
        recordError(
            state,
            error
        );


        completeAgentState(
            state,
            "failed"
        );


        await updateAgentRun({
            runId,
            conversationId,
            data: {
                status: "failed",
                error:
                    error.message,
                completedAt:
                    new Date()
            }
        });


        throw error;
    }
}