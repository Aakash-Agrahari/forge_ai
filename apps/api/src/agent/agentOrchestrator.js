import {
    createAgentState,
    incrementIteration,
    addMessage,
    recordToolCall,
    recordFileChange,
    recordError,
    recordVerificationResult,
    recordExecutionResult,
    completeAgentState,
    setAgentPhase,
    setCurrentTool,
    recordToolExecution,
    heartbeatAgentState
} from "./agentState.js";

import { executeTool } from "./toolRegistery.js";
import { getAgentTools } from "./toolSchema.js";
import { createAgentModelRequest } from "./agentModelRequest.js";
import { normalizeAgentModelResult } from "./agentModel.js";
import { selectModelsForRequest } from "../llm/modelSelectionService.js";
import { executeWithFallback } from "../llm/fallbackExecutor.js";
import { createMessage } from "../services/messageService.js";
import {
    updateAgentRun,
    updateAgentRunPhase,
    heartbeatAgentRun,
    createAgentRunEvent,
    isAgentRunCancellationRequested
} from "../services/agentRunService.js";
import { AGENT_SYSTEM_PROMPT } from "./agentSystemPrompt.js";
import { validateToolCall } from "./toolCallValidator.js";

const MAX_ITERATIONS = 10;
const MAX_IDENTICAL_TOOL_CALLS = 3;
const MAX_REPEATED_TOOL_RECOVERIES = 2;
const MAX_EARLY_COMPLETION_RETRIES = 2;

/*
 * ============================================================
 * TIMING HELPERS
 * ============================================================
 */

function elapsedMs(startedAt) {
    return Date.now() - startedAt;
}

function logAgentTiming(
    label,
    startedAt,
    metadata = {}
) {
    console.log(
        `[ForgeAI Agent][Timing] ${label}`,
        JSON.stringify({
            elapsedMs: elapsedMs(startedAt),
            ...metadata
        })
    );
}

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

function hasSuccessfulVerification(
    toolResults
) {
    return toolResults.some((result) => {
        if (!result?.success) {
            return false;
        }

        const toolName =
            result.toolName;

        if (
            toolName === "run_command" ||
            toolName === "execute_javascript" ||
            toolName === "run_javascript_test" ||
            toolName === "verify_javascript"
        ) {
            if (
                toolName ===
                "run_javascript_test"
            ) {
                return (
                    result.passed === true
                );
            }

            if (
                toolName ===
                "verify_javascript"
            ) {
                return (
                    result.verified === true
                );
            }

            return (
                result.exitCode === 0 ||
                result.success === true
            );
        }

        return false;
    });
}

function hasObservedExecutionFailure(
    toolResults
) {
    return toolResults.some((result) => {
        if (!result) {
            return false;
        }

        const toolName =
            result.toolName;

        /*
         * run_javascript_test has an
         * explicit passed field.
         */
        if (
            toolName ===
            "run_javascript_test"
        ) {
            return (
                result.passed === false
            );
        }

        /*
         * execute_javascript reports
         * runtime/execution failures.
         */
        if (
            toolName ===
            "execute_javascript"
        ) {
            return (
                result.success === false ||
                result.exitCode !== 0 ||
                result.timeOut === true
            );
        }

        /*
         * run_command normally exposes
         * success and exitCode.
         */
        if (
            toolName ===
            "run_command"
        ) {
            return (
                result.success === false ||
                result.exitCode !== 0 ||
                result.timeOut === true
            );
        }

        return false;
    });
}

function hasSuccessfulVerificationAfterFailure(
    toolResults
) {
    let failureObserved = false;

    for (const result of toolResults) {
        if (
            hasObservedExecutionFailure(
                [result]
            )
        ) {
            failureObserved = true;
            continue;
        }

        if (
            failureObserved &&
            hasSuccessfulVerification(
                [result]
            )
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
 * Once the user's required verification
 * is actually proven, the orchestrator stops.
 *
 * This prevents unnecessary follow-up calls
 * after a successful verification.
 * ============================================================
 */

function isCompletionReady(
    taskRequirements,
    toolResults
) {
    /*
     * Tasks without explicit verification
     * requirements do not use this guard.
     */
    if (
        !taskRequirements.requiresVerification
    ) {
        return false;
    }

    /*
     * We need actual successful evidence.
     */
    if (
        !hasSuccessfulVerification(
            toolResults
        )
    ) {
        return false;
    }

    /*
     * If the user requested a bug ->
     * failure -> repair -> verification flow,
     * we require both failure and later success.
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

function getJavaScriptVerificationStatus(
    toolResult
) {
    if (
        toolResult?.passed === true
    ) {
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
                category:
                    "REPAIR_REQUIRED",
                message:
                    "JavaScript behavioral test failed. The actual function behavior did not match the expected result. Inspect the test output and relevant implementation, diagnose the root cause, repair the incorrect code, and run run_javascript_test again."
            };

        case "TEST_SETUP_FAILURE":
        case "FUNCTION_NOT_FOUND":
        case "MODULE_IMPORT_FAILED":
            return {
                category:
                    "TEST_SETUP_ERROR",
                message:
                    "JavaScript behavioral verification could not be completed because of a test setup or module/function discovery problem. This is not evidence that the implementation is incorrect. Do not blindly modify the application code. Inspect the function name, exports, module format, imports, and test configuration first."
            };

        case "FUNCTION_EXECUTION_FAILED":
        case "RUNTIME_FAILURE":
            return {
                category:
                    "REPAIR_REQUIRED",
                message:
                    "JavaScript behavioral verification failed because the target function threw a runtime error. Inspect the reported error, diagnose the root cause, repair the relevant code if necessary, and run run_javascript_test again."
            };

        case "TEST_TIMEOUT":
        case "TIMEOUT":
            return {
                category:
                    "EXECUTION_PROBLEM",
                message:
                    "JavaScript behavioral verification timed out. Inspect the function for an execution or infinite-loop problem and use the test result to determine whether code repair is required."
            };

        case "SANDBOX_FAILURE":
            return {
                category:
                    "EXECUTION_PROBLEM",
                message:
                    "JavaScript behavioral verification could not complete because the sandbox failed. This does not by itself prove that the application code is incorrect. Inspect the sandbox error before modifying the implementation."
            };

        default:
            return {
                category:
                    "VERIFICATION_ERROR",
                message:
                    "JavaScript behavioral verification did not pass. Inspect the complete test result and determine whether the failure is an implementation problem, execution problem, or test setup problem. Do not modify correct application code solely to satisfy a broken test."
            };
    }
}

/*
 * ============================================================
 * PHASE / RUN STATE HELPERS
 * ============================================================
 */

async function persistAgentPhase({
    state,
    runId,
    phase,
    message = null,
    metadata = null
}) {
    setAgentPhase(state, phase);
    heartbeatAgentState(state);

    await updateAgentRunPhase(
        runId,
        phase,
        {
            message,
            metadata
        }
    );
}

async function persistAgentHeartbeat({
    state,
    runId,
    extraData = {}
}) {
    heartbeatAgentState(state);

    await heartbeatAgentRun(
        runId,
        {
            iteration: state.iteration,
            toolCount: state.toolCount,
            currentTool: state.currentTool,
            ...extraData
        }
    );
}

async function persistToolState({
    state,
    runId,
    toolName,
    status,
    metadata = null
}) {
    await createAgentRunEvent({
        runId,
        type: "tool_status",
        message: status,
        metadata: {
            tool: toolName,
            iteration: state.iteration,
            toolCount: state.toolCount,
            ...(metadata ?? {})
        }
    });

    await heartbeatAgentRun(
        runId,
        {
            iteration: state.iteration,
            toolCount: state.toolCount,
            currentTool: state.currentTool
        }
    );
}

async function handleCancellation({
    state,
    runId,
    conversationId,
    provider = null,
    model = null
}) {
    const requested =
        await isAgentRunCancellationRequested(runId);

    if (!requested) {
        return false;
    }

    setAgentPhase(state, "cancelled");
    setCurrentTool(state, null);
    completeAgentState(state, "cancelled");

    await createAgentRunEvent({
        runId,
        type: "cancelled",
        message: "Agent run cancelled by user.",
        metadata: {
            iteration: state.iteration,
            toolCount: state.toolCount
        }
    });

    await updateAgentRun(runId, {
        status: "cancelled",
        phase: "cancelled",
        currentTool: null,
        iteration: state.iteration,
        toolCount: state.toolCount,
        provider,
        model,
        completedAt: new Date()
    });

    return true;
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
    const runStartedAt =
        Date.now();

    const state =
        createAgentState({
            runId,
            projectId,
            conversationId
        });

    const toolCallHistory =
        new Map();

    const toolResults = [];

    let earlyCompletionRetries = 0;

    let repeatedToolRecoveries = 0;

    let hasPerformedWork = false;
    let heartbeatTimer = null;
    let cancellationObserved = false;

    const taskRequirements =
        getTaskRequirements(
            messages
        );

    /*
     * ============================================================
     * SYSTEM PROMPT
     * ============================================================
     */

    addMessage(state, {
        role: "system",
        content:
            AGENT_SYSTEM_PROMPT
    });

    /*
     * ============================================================
     * ACTIVE TASK CONTEXT
     * ============================================================
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
        heartbeatTimer = setInterval(() => {
            void (async () => {
                try {
                    const requested =
                        await isAgentRunCancellationRequested(runId);

                    if (requested) {
                        cancellationObserved = true;
                        return;
                    }

                    await persistAgentHeartbeat({
                        state,
                        runId
                    });
                } catch (heartbeatError) {
                    console.warn(
                        "[ForgeAI Agent] Heartbeat update failed:",
                        heartbeatError.message
                    );
                }
            })();
        }, 10000);

        /*
         * ========================================================
         * FIND ACTIVE USER TASK
         * ========================================================
         */

        const latestUserMessage =
            [...messages]
                .reverse()
                .find(
                    (message) =>
                        message.role ===
                        "user"
                );

        if (
            !latestUserMessage
        ) {
            const error =
                new Error(
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
                latestUserMessage.content ??
                ""
        });

        /*
         * ========================================================
         * UPDATE RUN STATUS
         * ========================================================
         */

        await updateAgentRun(runId, {
            status: "running",
            phase: "planning",
            iteration: state.iteration,
            toolCount: state.toolCount,
            currentTool: null,
            lastHeartbeatAt: new Date()
        });

        await createAgentRunEvent({
            runId,
            type: "run_started",
            message: "Agent run started.",
            metadata: {
                phase: "planning"
            }
        });

        setAgentPhase(state, "planning");

        /*
         * ========================================================
         * LOAD TOOLS
         * ========================================================
         */

        const tools =
            getAgentTools();

        /*
         * ========================================================
         * LOAD FREE TOOL-CALLING MODELS
         * ========================================================
         */

        const models =
            selectModelsForRequest({
                task: "code",
                freeOnly: true,
                toolCalling: true
            });

        if (
            models.length === 0
        ) {
            const error =
                new Error(
                    "No eligible tool-calling models available"
                );

            error.code =
                "NO_TOOL_CALLING_MODELS";

            error.statusCode = 503;

            throw error;
        }

        /*
         * ========================================================
         * MAIN AGENT LOOP
         * ========================================================
         */

        while (
            state.iteration <
            MAX_ITERATIONS
        ) {
            incrementIteration(
                state
            );

            await persistAgentHeartbeat({
                state,
                runId,
                extraData: {
                    phase: "planning"
                }
            });

            await createAgentRunEvent({
                runId,
                type: "iteration_started",
                message: `Iteration ${state.iteration} started.`,
                metadata: {
                    iteration: state.iteration
                }
            });

            if (cancellationObserved || await handleCancellation({
                state,
                runId,
                conversationId
            })) {
                return { state, result: null, cancelled: true };
            }

            const iterationStartedAt =
                Date.now();

            console.log(
                `[ForgeAI Agent] Iteration ${state.iteration}/${MAX_ITERATIONS} started`
            );

            /*
             * ====================================================
             * CREATE MODEL REQUEST
             * ====================================================
             */

            const request =
                createAgentModelRequest({
                    messages:
                        state.messages,
                    tools,
                    toolChoice:
                        "auto",
                    temperature:
                        0.2,
                    maxTokens:
                        8192
                });

            /*
             * ====================================================
             * MODEL EXECUTION
             * ====================================================
             */

            await persistAgentPhase({
                state,
                runId,
                phase: "planning",
                message: `Preparing model request for iteration ${state.iteration}.`,
                metadata: {
                    iteration: state.iteration
                }
            });

            const rawResult =
                await executeWithFallback({
                    models,
                    messages:
                        request.messages,
                    tools:
                        request.tools,
                    toolChoice:
                        request.toolChoice,
                    temperature:
                        request.temperature,
                    maxTokens:
                        request.maxTokens
                });

            const result =
                normalizeAgentModelResult(
                    rawResult
                );

            await updateAgentRun(runId, {
                provider: result.provider ?? null,
                model: result.model ?? null,
                iteration: state.iteration,
                toolCount: state.toolCount,
                lastHeartbeatAt: new Date()
            });

            logAgentTiming(
                "model iteration",
                iterationStartedAt,
                {
                    iteration:
                        state.iteration,
                    provider:
                        result.provider,
                    model:
                        result.model,
                    toolCalls:
                        result.toolCalls
                            ?.length ??
                        0
                }
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
             * ====================================================
             * STORE MODEL MESSAGE IN MEMORY
             * ====================================================
             */

            addMessage(state, {
                role: "assistant",
                content:
                    result.content,
                toolCalls:
                    result.toolCalls,
                provider:
                    result.provider,
                model:
                    result.model
            });

            /*
             * ====================================================
             * MODEL WANTS TO FINISH WITHOUT TOOL
             * ====================================================
             */

            if (
                !result.toolCalls ||
                result.toolCalls.length === 0
            ) {
                if (taskRequirements.requiresVerification) {
                    await persistAgentPhase({
                        state,
                        runId,
                        phase: "verifying",
                        message: "Checking whether required verification evidence exists.",
                        metadata: {
                            iteration: state.iteration
                        }
                    });
                }

                if (await handleCancellation({
                    state,
                    runId,
                    conversationId,
                    provider: result.provider,
                    model: result.model
                })) {
                    return { state, result: null, cancelled: true };
                }

                const verificationPassed =
                    !taskRequirements.requiresVerification ||
                    isCompletionReady(
                        taskRequirements,
                        toolResults
                    );

                /*
                 * =================================================
                 * REQUIRED VERIFICATION — FAIL CLOSED
                 * =================================================
                 *
                 * Never allow the model to claim completion
                 * when the user explicitly requested testing,
                 * execution, or verification.
                 */

                if (
                    taskRequirements.requiresVerification &&
                    !verificationPassed
                ) {
                    earlyCompletionRetries += 1;

                    const continuationMessage =
                        [
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

                    addMessage(
                        state,
                        {
                            role: "system",
                            content:
                                continuationMessage
                        }
                    );

                    console.log(
                        "[ForgeAI Agent] Blocked completion: required verification has not passed."
                    );

                    if (
                        earlyCompletionRetries >=
                        MAX_EARLY_COMPLETION_RETRIES
                    ) {
                        const error =
                            new Error(
                                "Agent repeatedly attempted to complete before required verification succeeded."
                            );

                        error.code =
                            "PREMATURE_COMPLETION";

                        error.statusCode =
                            503;

                        throw error;
                    }

                    continue;
                }

                /*
                 * =================================================
                 * NORMAL COMPLETION
                 * =================================================
                 */

                await createMessage({
                    conversationId,
                    role: "assistant",
                    content:
                        result.content ??
                        ""
                });

                completeAgentState(
                    state,
                    "completed"
                );

                setAgentPhase(state, "completed");
                setCurrentTool(state, null);

                await createAgentRunEvent({
                    runId,
                    type: "completed",
                    message: "Agent run completed successfully.",
                    metadata: {
                        iteration: state.iteration,
                        toolCount: state.toolCount
                    }
                });

                await updateAgentRun(runId, {
                    status:
                        "completed",
                    provider:
                        result.provider,
                    model:
                        result.model,
                    iteration: state.iteration,
                    toolCount: state.toolCount,
                    currentTool: null,
                    phase: "completed",
                    completedAt:
                        new Date()
                });

                logAgentTiming(
                    "agent completed",
                    runStartedAt,
                    {
                        iterations:
                            state.iteration,
                        reason:
                            "model_completion"
                    }
                );

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

            for (
                const toolCall
                of result.toolCalls
            ) {
                await createMessage({
                    conversationId,
                    role: "assistant",
                    content:
                        result.content ??
                        "",
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
             * EXECUTE MODEL TOOLS
             * ====================================================
             */

            await persistAgentPhase({
                state,
                runId,
                phase: "executing",
                message: `Executing ${result.toolCalls.length} tool call(s).`,
                metadata: {
                    iteration: state.iteration,
                    toolCalls: result.toolCalls.length
                }
            });

            for (
                const toolCall
                of result.toolCalls
            ) {
                /*
                 * =================================================
                 * VALIDATE TOOL CALL
                 * =================================================
                 */

                const validatedToolCall =
                    validateToolCall(
                        toolCall
                    );

                if (cancellationObserved || await handleCancellation({
                    state,
                    runId,
                    conversationId,
                    provider: result.provider,
                    model: result.model
                })) {
                    return { state, result: null, cancelled: true };
                }

                /*
                 * =================================================
                 * IDENTICAL TOOL CALL DETECTION
                 * =================================================
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
                 * =================================================
                 * REPEATED TOOL CALL RECOVERY
                 * =================================================
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
                        const error =
                            new Error(
                                `Agent could not recover from repeated tool call: ${validatedToolCall.name}`
                            );

                        error.code =
                            "REPEATED_TOOL_CALL_RECOVERY_FAILED";

                        error.statusCode =
                            503;

                        throw error;
                    }

                    const recoveryMessage =
                        [
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

                    addMessage(
                        state,
                        {
                            role: "system",
                            content:
                                recoveryMessage
                        }
                    );

                    /*
                     * Do not execute the duplicate.
                     * Give the model another iteration.
                     */

                    continue;
                }

                /*
                 * =================================================
                 * START REAL TOOL EXECUTION
                 * =================================================
                 */

                setCurrentTool(
                    state,
                    validatedToolCall.name
                );

                recordToolExecution(
                    state
                );

                await heartbeatAgentRun(
                    runId,
                    {
                        iteration:
                            state.iteration,
                        toolCount:
                            state.toolCount,
                        currentTool:
                            validatedToolCall.name,
                        phase:
                            "executing"
                    }
                );

                await createAgentRunEvent({
                    runId,
                    type: "tool_started",
                    message:
                        `Tool ${validatedToolCall.name} started.`,
                    metadata: {
                        tool:
                            validatedToolCall.name,
                        iteration:
                            state.iteration,
                        toolCount:
                            state.toolCount
                    }
                });

                /*
                 * =================================================
                 * RECORD TOOL CALL
                 * =================================================
                 */

                recordToolCall(
                    state,
                    {
                        id:
                            validatedToolCall.id,
                        name:
                            validatedToolCall.name,
                        input:
                            validatedToolCall.arguments,
                        iteration:
                            state.iteration
                    }
                );

                /*
                 * =================================================
                 * EXECUTE TOOL
                 * =================================================
                 */

                let toolResult;

                const toolStartedAt =
                    Date.now();

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
                 * TOOL TIMING
                 * =================================================
                 */

                logAgentTiming(
                    "tool execution",
                    toolStartedAt,
                    {
                        iteration:
                            state.iteration,
                        tool:
                            validatedToolCall.name,
                        success:
                            toolResult?.success ===
                            true,
                        passed:
                            toolResult?.passed ===
                            true,
                        failureType:
                            toolResult?.failureType ??
                            null
                    }
                );

                /*
                 * =================================================
                 * JAVASCRIPT TEST FEEDBACK
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

                    addMessage(
                        state,
                        {
                            role: "system",
                            content:
                                verification.message
                        }
                    );

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

                    addMessage(
                        state,
                        {
                            role: "system",
                            content:
                                verificationStatus
                        }
                    );

                    console.log(
                        "[ForgeAI Agent] Verification status:",
                        verificationStatus
                    );
                }

                /*
                 * =================================================
                 * LOG TOOL RESULT
                 * =================================================
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

                    addMessage(
                        state,
                        {
                            role: "system",
                            content:
                                executionStatus
                        }
                    );

                    console.log(
                        "[ForgeAI Agent] Execution status:",
                        executionStatus
                    );
                }

                /*
                 * =================================================
                 * STORE TOOL RESULT IN MEMORY
                 * =================================================
                 */

                toolResults.push({
                    toolName:
                        validatedToolCall.name,
                    ...toolResult
                });

                if (
                    toolResult?.success
                ) {
                    hasPerformedWork =
                        true;
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
                 * =================================================
                 * ADD TOOL RESULT TO AGENT MEMORY
                 * =================================================
                 */

                addMessage(
                    state,
                    {
                        role: "tool",
                        toolCallId:
                            validatedToolCall.id,
                        toolName:
                            validatedToolCall.name,
                        content:
                            serializedToolResult
                    }
                );

                await createAgentRunEvent({
                    runId,
                    type: "tool_completed",
                    message:
                        `Tool ${validatedToolCall.name} completed.`,
                    metadata: {
                        tool:
                            validatedToolCall.name,
                        iteration:
                            state.iteration,
                        toolCount:
                            state.toolCount,
                        success:
                            toolResult?.success ===
                            true,
                        passed:
                            toolResult?.passed ===
                            true,
                        failureType:
                            toolResult?.failureType ??
                            null
                    }
                });

                setCurrentTool(
                    state,
                    null
                );

                await persistAgentHeartbeat({
                    state,
                    runId
                });

                /*
                 * =================================================
                 * EXPLICIT TOOL STATUS
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

                addMessage(
                    state,
                    {
                        role: "system",
                        content:
                            toolStatus
                    }
                );

                /*
                 * =================================================
                 * DETERMINISTIC COMPLETION GUARD
                 * =================================================
                 *
                 * IMPORTANT:
                 *
                 * This happens AFTER the tool result has been
                 * persisted and added to agent memory.
                 *
                 * If verification has succeeded, stop immediately.
                 *
                 * Do NOT allow another model iteration.
                 * =================================================
                 */

                if (cancellationObserved || await handleCancellation({
                    state,
                    runId,
                    conversationId,
                    provider: result.provider,
                    model: result.model
                })) {
                    return {
                        state,
                        result: null,
                        cancelled: true
                    };
                }

                if (
                    isCompletionReady(
                        taskRequirements,
                        toolResults
                    )
                ) {
                    const completionMessage =
                        "Task completed successfully and verified with actual execution evidence.";

                    console.log(
                        "[ForgeAI Agent] Completion guard triggered.",
                        {
                            iteration:
                                state.iteration,
                            elapsedMs:
                                elapsedMs(
                                    runStartedAt
                                ),
                            verifiedBy:
                                validatedToolCall.name
                        }
                    );

                    addMessage(
                        state,
                        {
                            role: "system",
                            content:
                                completionMessage
                        }
                    );

                    await createMessage({
                        conversationId,
                        role: "assistant",
                        content:
                            completionMessage
                    });

                    completeAgentState(
                        state,
                        "completed"
                    );

                    setAgentPhase(
                        state,
                        "completed"
                    );

                    setCurrentTool(
                        state,
                        null
                    );

                    await createAgentRunEvent({
                        runId,
                        type: "completed",
                        message:
                            "Task completed successfully and verification evidence was recorded.",
                        metadata: {
                            iteration:
                                state.iteration,
                            toolCount:
                                state.toolCount,
                            verifiedBy:
                                validatedToolCall.name
                        }
                    });

                    await updateAgentRun(runId, {
                        status:
                            "completed",
                        provider:
                            result.provider,
                        model:
                            result.model,
                        iteration:
                            state.iteration,
                        toolCount:
                            state.toolCount,
                        currentTool:
                            null,
                        phase:
                            "completed",
                        completedAt:
                            new Date()
                    });

                    logAgentTiming(
                        "agent completed",
                        runStartedAt,
                        {
                            iterations:
                                state.iteration,
                            reason:
                                "verified_completion",
                            verifiedBy:
                                validatedToolCall.name
                        }
                    );

                    return {
                        state,
                        result: {
                            ...result,
                            content:
                                result.content ||
                                completionMessage,
                            completionGuardTriggered:
                                true
                        }
                    };
                }
            }
        }

        /*
         * ========================================================
         * MAX ITERATION SAFETY LIMIT
         * ========================================================
         */

        const error =
            new Error(
                `Agent exceeded maximum iterations (${MAX_ITERATIONS})`
            );

        error.code =
            "MAX_AGENT_ITERATIONS";

        error.statusCode =
            503;

        logAgentTiming(
            "agent iteration limit reached",
            runStartedAt,
            {
                iterations:
                    state.iteration
            }
        );

        throw error;

    } catch (error) {
        /*
         * ========================================================
         * AGENT FAILURE
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

        logAgentTiming(
            "agent failed",
            runStartedAt,
            {
                iterations:
                    state.iteration,
                errorCode:
                    error.code ??
                    null,
                error:
                    error.message
            }
        );

        const cancellationRequested =
            error?.code ===
                "AGENT_RUN_CANCELLED" ||
            await isAgentRunCancellationRequested(
                runId
            );

        if (cancellationRequested) {
            setAgentPhase(
                state,
                "cancelled"
            );

            setCurrentTool(
                state,
                null
            );

            completeAgentState(
                state,
                "cancelled"
            );

            await createAgentRunEvent({
                runId,
                type: "cancelled",
                message:
                    "Agent run cancelled.",
                metadata: {
                    iteration:
                        state.iteration,
                    toolCount:
                        state.toolCount
                }
            });

            await updateAgentRun(runId, {
                status:
                    "cancelled",
                phase:
                    "cancelled",
                currentTool:
                    null,
                iteration:
                    state.iteration,
                toolCount:
                    state.toolCount,
                completedAt:
                    new Date()
            });

            return {
                state,
                result: null,
                cancelled: true
            };
        }

        setAgentPhase(
            state,
            "failed"
        );

        setCurrentTool(
            state,
            null
        );

        await createAgentRunEvent({
            runId,
            type: "failed",
            message:
                error.message,
            metadata: {
                code:
                    error.code ??
                    null,
                iteration:
                    state.iteration,
                toolCount:
                    state.toolCount
            }
        });

        await updateAgentRun(runId, {
            status:
                "failed",
            phase:
                "failed",
            currentTool:
                null,
            iteration:
                state.iteration,
            toolCount:
                state.toolCount,
            error:
                error.message,
            completedAt:
                new Date()
        });

        throw error;

    } finally {
        if (heartbeatTimer) {
            clearInterval(
                heartbeatTimer
            );

            heartbeatTimer =
                null;
        }
    }
}