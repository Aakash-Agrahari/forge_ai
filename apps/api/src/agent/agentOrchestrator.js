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

        /*
         * ============================================================
         * LANGUAGE-AWARE CODE EXECUTION
         * ============================================================
         */

        if (
            toolName === "execute_code"
        ) {
            return (
                result.success === true &&
                (
                    result.exitCode === undefined ||
                    result.exitCode === 0
                )
            );
        }

        /*
         * ============================================================
         * LEGACY / SPECIALIZED EXECUTION TOOLS
         * ============================================================
         */

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

function isInfrastructureFailureResult(result) {
    const failureType =
        result?.failureType ??
        result?.execution?.failureType ??
        result?.build?.failureType ??
        result?.failureCode ??
        result?.error?.code ??
        null;

    return (
        failureType === "RUNTIME_UNAVAILABLE" ||
        failureType === "SANDBOX_FAILURE"
    );
}

function hasObservedExecutionFailure(
    toolResults
) {
    return toolResults.some((result) => {
        if (!result || isInfrastructureFailureResult(result)) {
            return false;
        }

        const toolName = result.toolName;

        if (toolName === "run_javascript_test") {
            return result.passed === false;
        }

        if (
            toolName === "execute_code" ||
            toolName === "execute_javascript"
        ) {
            return (
                result.success === false ||
                (
                    result.exitCode !== undefined &&
                    result.exitCode !== null &&
                    result.exitCode !== 0
                ) ||
                result.timeOut === true
            );
        }

        if (toolName === "run_command") {
            return (
                result.success === false ||
                (
                    result.exitCode !== undefined &&
                    result.exitCode !== null &&
                    result.exitCode !== 0
                ) ||
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
 */

function isCompletionReady(
    taskRequirements,
    toolResults,
    failureRepairPhase,
    repairPerformed
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
     * We need actual successful execution
     * evidence.
     */
    if (
        !hasSuccessfulVerification(
            toolResults
        )
    ) {
        return false;
    }

    /*
     * For failure-and-repair tasks, completion
     * is valid only after the repair has actually
     * been performed and the agent has reached
     * the VERIFY phase.
     *
     * This intentionally does NOT require the
     * first execution to have exitCode != 0,
     * because a logic bug can execute successfully
     * while still producing an incorrect result.
     */
    if (
        taskRequirements.requiresFailureAndRepair
    ) {
        return (
            repairPerformed &&
            failureRepairPhase === "COMPLETE"
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

    let intentionalFailurePrepared = false;
    let sourcePreparationEditPerformed = false;
    let existingSourceInspected = false;
    let failureObserved = false;
    let repairPerformed = false;

    const taskRequirements =
        getTaskRequirements(
            messages
        );

    let failureRepairPhase =
        taskRequirements.requiresFailureAndRepair
            ? "PREPARE"
            : "NONE";

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
            "",
            "EXECUTION DISCIPLINE:",
            "When a task requires a failure-and-repair workflow, follow this exact sequence:",
            "",
            "PHASE 1 - PREPARE",
            "Create or modify the requested source file if necessary.",
            "If the requested source file already exists, inspect it once.",
            "If the existing source already contains the ONE intentional bug required by the user's request, do NOT modify it again; proceed directly to execution.",
            "If the intentional bug is not present, introduce exactly ONE intentional bug.",
            "Do NOT introduce multiple bugs.",
            "Once the source is prepared OR an existing source containing the required intentional bug has been inspected, proceed to EXECUTE.",
            "Do NOT introduce multiple bugs.",
            "Do NOT repeatedly modify the implementation trying to guarantee a failure.",
            "Do NOT change from one bug to another before executing.",
            "",
            "PHASE 2 - EXECUTE",
            "After the intentional bug has been introduced, immediately call the requested execution or verification tool.",
            "Do NOT make another source modification before observing the execution result.",
            "Do NOT perform exploratory modifications merely to force a failure.",
            "",
            "PHASE 3 - DIAGNOSE",
            "After execution fails, inspect the actual stdout, stderr, exit code, failure type, and execution evidence.",
            "Do not guess the failure.",
            "Do not repair code unless the execution evidence identifies a source-level problem.",
            "",
            "PHASE 4 - REPAIR",
            "Repair the source code based on the actual execution evidence.",
            "Make the smallest necessary repair.",
            "Do not introduce another intentional bug.",
            "Do not make unrelated changes.",
            "",
            "PHASE 5 - VERIFY",
            "Immediately execute the requested execution or verification tool again after the repair.",
            "Do NOT read the repaired source file again before execution.",
            "Do NOT perform an additional inspection step between repair and verification.",
            "The repair operation itself is sufficient to establish the new source state.",
            "Do not claim success from source inspection.",
            "Do not claim success from a successful file-edit operation.",
            "Only execution or verification evidence can establish success.",
            "",
            "POST-REPAIR EXECUTION RULE:",
            "Once a source repair has been successfully applied after an observed execution failure, the next meaningful action MUST be execution or verification.",
            "Do not:",
            "- read the repaired file again",
            "- inspect unrelated files",
            "- modify unrelated code",
            "- explain the repair before executing",
            "- perform exploratory actions",
            "",
            "Execute the repaired code immediately.",
            "PHASE 6 - COMPLETE",
            "Only complete the task after the required execution or verification succeeds.",
            "Once the required verification succeeds, STOP immediately.",
            "Do not perform additional actions after successful verification.",
            "",
            "INFRASTRUCTURE FAILURES:",
            "If execute_code reports RUNTIME_UNAVAILABLE or SANDBOX_FAILURE, do not modify application source.",
            "Do not create launcher scripts or replacement executables.",
            "Do not switch languages.",
            "Do not invent alternate commands.",
            "Treat the problem as an execution-environment failure.",
            "",
            "Only repair application code when execution evidence indicates a source-level problem."
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
                        toolResults,
                        failureRepairPhase,
                        repairPerformed
                    );

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
                                *
                                * Tool-call validation failures are recoverable.
                                *
                                * A model can occasionally generate an argument that
                                * does not match the registered tool schema. The
                                * validator must reject that call, but the rejection
                                * must be returned to the model as tool feedback
                                * instead of terminating the entire agent run.
                                */

                                let validatedToolCall;

                                try {
                                    validatedToolCall =
                                        validateToolCall(
                                            toolCall
                                        );
                                } catch (validationError) {
                                    const validationToolResult = {
                                        success: false,
                                        error: {
                                            code:
                                                validationError.code ??
                                                "INVALID_TOOL_CALL",
                                            message:
                                                validationError.message ??
                                                "Tool call validation failed"
                                        }
                                    };

                                    /*
                                    * Record the validation problem in agent state.
                                    * This does NOT mark the entire agent as failed.
                                    */
                                    recordError(
                                        state,
                                        validationError
                                    );

                                    console.warn(
                                        "[ForgeAI Agent] Tool call validation failed:",
                                        JSON.stringify(
                                            {
                                                tool:
                                                    toolCall?.name ??
                                                    null,
                                                toolCallId:
                                                    toolCall?.id ??
                                                    null,
                                                code:
                                                    validationError.code ??
                                                    "INVALID_TOOL_CALL",
                                                message:
                                                    validationError.message ??
                                                    "Tool call validation failed"
                                            },
                                            null,
                                            2
                                        )
                                    );

                                    /*
                                    * Give the model explicit feedback so it can
                                    * correct the tool call on the next iteration.
                                    */
                                    addMessage(
                                        state,
                                        {
                                            role: "system",
                                            content: [
                                                "TOOL CALL VALIDATION FAILED.",
                                                "",
                                                `Tool: ${toolCall?.name ?? "unknown"}`,
                                                `Error: ${
                                                    validationError.message ??
                                                    "Invalid tool call"
                                                }`,
                                                "",
                                                "The tool call was NOT executed.",
                                                "Do not repeat the invalid arguments.",
                                                "Inspect the tool definition and call the tool again using the correct arguments.",
                                                "",
                                                "Important:",
                                                "- Do not modify application source code because of this validation error.",
                                                "- Do not invent arguments that are not present in the tool schema.",
                                                "- If a tool accepts no arguments, call it with an empty object.",
                                                "- Continue the current task from the validation result."
                                            ].join("\n")
                                        }
                                    );

                                    /*
                                    * Persist the rejected tool call as a tool result.
                                    *
                                    * This gives the LLM an actual structured result
                                    * associated with its tool call rather than only
                                    * an internal exception.
                                    */
                                    const serializedValidationResult =
                                        JSON.stringify(
                                            validationToolResult
                                        );

                                    await createMessage({
                                        conversationId,
                                        role: "tool",
                                        content:
                                            serializedValidationResult,
                                        toolCallId:
                                            toolCall?.id ?? null,
                                        toolName:
                                            toolCall?.name ?? "unknown",
                                        toolResult:
                                            validationToolResult
                                    });

                                    addMessage(
                                        state,
                                        {
                                            role: "tool",
                                            toolCallId:
                                                toolCall?.id ?? null,
                                            toolName:
                                                toolCall?.name ?? "unknown",
                                            content:
                                                serializedValidationResult
                                        }
                                    );

                                    await createAgentRunEvent({
                                        runId,
                                        type: "tool_completed",
                                        message:
                                            `Tool ${
                                                toolCall?.name ??
                                                "unknown"
                                            } rejected during argument validation.`,
                                        metadata: {
                                            tool:
                                                toolCall?.name ??
                                                null,
                                            iteration:
                                                state.iteration,
                                            toolCount:
                                                state.toolCount,
                                            success: false,
                                            validationError:
                                                validationError.code ??
                                                "INVALID_TOOL_CALL"
                                        }
                                    });

                                    /*
                                    * The invalid call has been handled.
                                    *
                                    * Do NOT execute it.
                                    * Do NOT enter the failure/repair workflow.
                                    * Do NOT count it as application-code failure.
                                    *
                                    * Move to the next model iteration so the model
                                    * can correct the tool call.
                                    */
                                    setCurrentTool(
                                        state,
                                        null
                                    );

                                    await persistAgentHeartbeat({
                                        state,
                                        runId
                                    });

                                    continue;
                                }

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

                const allowRepeatedExecutionForFailureRepair =
                    taskRequirements.requiresFailureAndRepair &&
                    (
                        validatedToolCall.name === "execute_code" ||
                        validatedToolCall.name === "execute_javascript" ||
                        validatedToolCall.name === "run_javascript_test"
                    );

                if (
                    currentCount >
                    MAX_IDENTICAL_TOOL_CALLS &&
                    !allowRepeatedExecutionForFailureRepair
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
                            "If this is a failure-and-repair task and the phase is EXECUTE, execute the target immediately.",
                            "If this is a failure-and-repair task and the phase is REPAIR, repair the source using the actual execution evidence.",
                            "If this is a failure-and-repair task and the phase is VERIFY, execute the repaired source immediately.",
                            "Do NOT read the repaired file again before verification.",
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

                    continue;
                }

                /*
                 * ============================================================
                 * FAILURE / REPAIR WORKFLOW GUARD
                 * ============================================================
                 */

                if (taskRequirements.requiresFailureAndRepair) {
                    const toolName =
                        validatedToolCall.name;

                    const isExecutionTool =
                        toolName === "execute_code" ||
                        toolName === "execute_javascript" ||
                        toolName === "run_javascript_test";

                    const isSourceEditTool =
                        toolName === "write_file" ||
                        toolName === "edit_file" ||
                        toolName === "replace_in_file";

                    if (
                        failureRepairPhase === "PREPARE" &&
                        sourcePreparationEditPerformed &&
                        isSourceEditTool
                    ) {
                        addMessage(state, {
                            role: "system",
                            content: [
                                "FAILURE-AND-REPAIR WORKFLOW VIOLATION.",
                                "",
                                "The requested source has already been prepared once.",
                                "Do NOT modify the source again before the first execution.",
                                "",
                                "Execute the target code now."
                            ].join("\n")
                        });
                        continue;
                    }

                    if (
                        failureRepairPhase === "PREPARE" &&
                        isExecutionTool &&
                        !sourcePreparationEditPerformed &&
                        !existingSourceInspected
                    ) {
                        addMessage(state, {
                            role: "system",
                            content: [
                                "FAILURE-AND-REPAIR WORKFLOW VIOLATION.",
                                "",
                                "The task requires an intentional failure before the first execution.",
                                "The requested source has not yet been prepared or inspected.",
                                "",
                                "First create or modify the requested source to introduce ONE intentional bug.",
                                "Do not introduce multiple bugs.",
                                "After the source preparation succeeds, execute the target code."
                            ].join("\n")
                        });

                        continue;
                    }

                    if (
                        failureRepairPhase === "EXECUTE" &&
                        !isExecutionTool
                    ) {
                        addMessage(state, {
                            role: "system",
                            content: [
                                "FAILURE-AND-REPAIR WORKFLOW VIOLATION.",
                                "",
                                "The intentional failure has been prepared.",
                                "The next action MUST be execution.",
                                "Do NOT modify the source again.",
                                "Do NOT read the file again.",
                                "Execute the target code now."
                            ].join("\n")
                        });
                        continue;
                    }

                    if (
                        failureRepairPhase === "REPAIR" &&
                        isExecutionTool
                    ) {
                        addMessage(state, {
                            role: "system",
                            content: [
                                "FAILURE-AND-REPAIR WORKFLOW VIOLATION.",
                                "",
                                "Execution has already failed with a source-level failure.",
                                "Repair the source code using the actual failure evidence before executing again.",
                                "Do NOT execute again before the repair."
                            ].join("\n")
                        });
                        continue;
                    }

                    if (
                        failureRepairPhase === "REPAIR" &&
                        !isSourceEditTool &&
                        !isExecutionTool
                    ) {
                        addMessage(state, {
                            role: "system",
                            content: [
                                "FAILURE-AND-REPAIR WORKFLOW VIOLATION.",
                                "",
                                "A source-level execution failure has been observed.",
                                "Repair the source code based on the actual error.",
                                "Do NOT perform unrelated actions."
                            ].join("\n")
                        });
                        continue;
                    }

                    if (
                        failureRepairPhase === "VERIFY" &&
                        !isExecutionTool
                    ) {
                        addMessage(state, {
                            role: "system",
                            content: [
                                "POST-REPAIR VERIFICATION REQUIRED.",
                                "",
                                "The source repair has been applied successfully.",
                                "The next meaningful action MUST be execution or verification.",
                                "Do NOT read the repaired file again.",
                                "Do NOT perform unrelated actions."
                            ].join("\n")
                        });
                        continue;
                    }
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

                const postToolSystemMessages = [];
                if (
                    validatedToolCall.name ===
                        "execute_code" ||
                    validatedToolCall.name ===
                        "execute_javascript"
                ) {
                    recordExecutionResult(
                        state,
                        toolResult
                    );

                    const failureType =
                        toolResult?.failureType ??
                        toolResult?.execution?.failureType ??
                        toolResult?.build?.failureType ??
                        null;

                    let executionStatus;

                    if (
                        toolResult?.success === true &&
                        (
                            toolResult?.exitCode ===
                                undefined ||
                            toolResult?.exitCode ===
                                null ||
                            toolResult?.exitCode === 0
                        ) &&
                        !toolResult?.timeOut
                    ) {
                        executionStatus =
                            "Code execution succeeded. Actual execution evidence confirms the program ran successfully.";
                    } else if (
                        failureType ===
                        "RUNTIME_UNAVAILABLE"
                    ) {
                        executionStatus =
                            "Execution infrastructure failure: the required runtime is unavailable. Do NOT modify the application source, create launcher scripts, create replacement executables, switch languages, or repeat the same execution command. Treat this as an infrastructure/runtime availability problem.";
                    } else if (
                        failureType ===
                        "SANDBOX_FAILURE"
                    ) {
                        executionStatus =
                            "Sandbox infrastructure failure. Do NOT modify the application source or invent workaround commands. Treat this as an execution-environment problem.";
                    } else {
                        executionStatus =
                            "Code execution failed. Inspect the actual execution result and determine whether the failure is caused by the application source, compilation, runtime behavior, timeout, or execution infrastructure before taking corrective action.";
                    }

                    postToolSystemMessages.push(
                        executionStatus
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

                /*
                * ============================================================
                * EXISTING SOURCE INSPECTION
                * ============================================================
                *
                * If the requested source already existed, allow the agent to
                * inspect it once during PREPARE.
                *
                * If the inspected source already contains the intentional bug,
                * the next action may be execution without another source edit.
                */

                if (
                    taskRequirements.requiresFailureAndRepair &&
                    failureRepairPhase === "PREPARE" &&
                    validatedToolCall.name === "read_file" &&
                    toolResult?.success === true
                ) {
                    existingSourceInspected = true;

                    /*
                    * The existing file has now been inspected.
                    *
                    * The model has been instructed to determine whether the
                    * required intentional bug is already present.
                    *
                    * For an existing source that already contains the required
                    * intentional bug, the next action is execution.
                    */
                    failureRepairPhase = "EXECUTE";
                    intentionalFailurePrepared = true;

                    addMessage(state, {
                        role: "system",
                        content: [
                            "EXISTING SOURCE INSPECTED.",
                            "",
                            "The requested source file already existed and has now been inspected.",
                            "",
                            "The source is now considered prepared for the required failure-and-repair workflow.",
                            "Proceed immediately with execute_code.",
                            "",
                            "Do NOT read the same source file again.",
                            "Do NOT modify the source again before the first execution."
                        ].join("\n")
                    });

                    console.log(
                        "[ForgeAI Agent] Existing source inspected during PREPARE. Moving directly to EXECUTE."
                    );
                }

                /*
                 * ============================================================
                 * FAILURE / REPAIR WORKFLOW STATE TRACKING
                 * ============================================================
                 */

                if (
                    taskRequirements.requiresFailureAndRepair
                ) {
                    const toolName =
                        validatedToolCall.name;

                    const isSourceEditTool =
                        toolName === "write_file" ||
                        toolName === "edit_file" ||
                        toolName === "replace_in_file";

                    const isExecutionTool =
                        toolName === "execute_code" ||
                        toolName === "execute_javascript" ||
                        toolName === "run_javascript_test";

                    if (
                        isSourceEditTool &&
                        toolResult?.success === true &&
                        failureRepairPhase === "PREPARE"
                    ) {
                        sourcePreparationEditPerformed = true;
                        intentionalFailurePrepared = true;

                        failureRepairPhase = "EXECUTE";

                        console.log(
                            "[ForgeAI Agent] Failure-and-repair: preparation edit completed. Moving directly to EXECUTE."
                        );
                    }

                    if (
                        isExecutionTool
                    ) {
                        const executionFailed =
                            toolName === "run_javascript_test"
                                ? toolResult?.passed === false
                                : (
                                    toolResult?.success === false ||
                                    (
                                        toolResult?.exitCode !== undefined &&
                                        toolResult?.exitCode !== null &&
                                        toolResult?.exitCode !== 0
                                    ) ||
                                    toolResult?.timeOut === true
                                );

                        const infrastructureFailure =
                            isInfrastructureFailureResult(toolResult);

                        /*
                        * ============================================================
                        * FIRST EXECUTION
                        * ============================================================
                        *
                        * The first execution is expected to expose the intentional
                        * bug. A logic bug may still exit with code 0, so successful
                        * process execution is NOT considered task completion here.
                        */
                        if (
                            executionFailed &&
                            !infrastructureFailure
                        ) {
                            failureObserved = true;
                            failureRepairPhase = "REPAIR";

                            console.log(
                                "[ForgeAI Agent] Failure-and-repair: source-level failure observed."
                            );
                        } else if (
                            !executionFailed &&
                            !infrastructureFailure &&
                            failureRepairPhase === "EXECUTE"
                        ) {
                            /*
                            * The program executed successfully, but this is still
                            * the FIRST execution.
                            *
                            * The task explicitly requires the intentional bug to
                            * produce an incorrect result before repair.
                            */
                            failureObserved = true;
                            failureRepairPhase = "REPAIR";

                            postToolSystemMessages.push(
                                [
                                    "FIRST EXECUTION COMPLETED.",
                                    "",
                                    "The program executed successfully, but this task explicitly requires the first execution to expose an intentional bug.",
                                    "Inspect the ACTUAL execution output, stdout, stderr, and exit code.",
                                    "",
                                    "If the result is incorrect because of the intentional logic bug, repair the source code now.",
                                    "Make the smallest necessary repair.",
                                    "Do NOT introduce another bug.",
                                    "",
                                    "After the repair succeeds, execute the repaired source immediately for verification.",
                                    "Do NOT read the repaired file again before verification."
                                ].join("\n")
                            );

                            console.log(
                                "[ForgeAI Agent] Failure-and-repair: first execution completed. Moving to REPAIR."
                            );
                        }

                        /*
                        * ============================================================
                        * POST-REPAIR VERIFICATION
                        * ============================================================
                        *
                        * The source has already been repaired.
                        *
                        * If the repaired execution succeeds, the required
                        * execution/verification evidence now exists.
                        *
                        * IMPORTANT:
                        * This is the missing VERIFY -> COMPLETE transition.
                        */
                        else if (
                            !executionFailed &&
                            !infrastructureFailure &&
                            failureRepairPhase === "VERIFY" &&
                            repairPerformed
                        ) {
                            failureRepairPhase = "COMPLETE";

                            postToolSystemMessages.push(
                                [
                                    "FINAL VERIFICATION SUCCEEDED.",
                                    "",
                                    "The repaired source executed successfully.",
                                    "Actual execution evidence has been received.",
                                    "",
                                    "The failure-and-repair workflow is now COMPLETE.",
                                    "Stop immediately after reporting the verified result.",
                                    "Do NOT perform any additional tool actions."
                                ].join("\n")
                            );

                            console.log(
                                "[ForgeAI Agent] Failure-and-repair: final verification succeeded. Moving to COMPLETE."
                            );
                        }
                    }

                    if (
                        isSourceEditTool &&
                        toolResult?.success === true &&
                        failureRepairPhase === "REPAIR" &&
                        failureObserved
                    ) {
                        repairPerformed = true;
                        failureRepairPhase = "VERIFY";

                        console.log(
                            "[ForgeAI Agent] Failure-and-repair: source repair performed."
                        );
                    }
                }

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
                    const failureType =
                        toolResult?.failureType ??
                        toolResult?.execution?.failureType ??
                        toolResult?.build?.failureType ??
                        null;

                    if (
                        failureType ===
                        "RUNTIME_UNAVAILABLE"
                    ) {
                        toolStatus =
                            `Tool "${validatedToolCall.name}" failed because the required runtime is unavailable. Do not modify application source code, create launcher scripts, create replacement executables, switch languages, or repeat the same failed execution command.`;
                    } else if (
                        failureType ===
                        "SANDBOX_FAILURE"
                    ) {
                        toolStatus =
                            `Tool "${validatedToolCall.name}" failed because of a sandbox or execution-environment problem. Do not modify application source code or invent workaround commands.`;
                    } else {
                        toolStatus =
                            toolResult?.success
                                ? `Tool "${validatedToolCall.name}" completed successfully. Use this result as evidence. Do not repeat the same tool call unless the project state has changed or additional information is required.`
                                : `Tool "${validatedToolCall.name}" failed. Inspect the returned execution evidence, determine whether the failure is in the source code or infrastructure, and take corrective action only when the evidence supports it.`;
                    }
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
                        toolResults,
                        failureRepairPhase,
                        repairPerformed
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