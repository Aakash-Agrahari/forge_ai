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

/*
 * Detect whether the user's request explicitly requires
 * behavioral JavaScript verification.
 *
 * We intentionally do not require verification for every
 * JavaScript task. The requirement is activated only when
 * the user explicitly asks for behavioral/runtime testing.
 */
function requiresBehavioralVerification(messages) {
    const userMessages = messages
        .filter((message) => message?.role === "user")
        .map((message) => message?.content ?? "")
        .join("\n")
        .toLowerCase();

    if (!userMessages) {
        return false;
    }

    const verificationSignals = [
        "run_javascript_test",
        "behavioral verification",
        "behaviorally verify",
        "behavioral test",
        "behaviorally test",
        "runtime verification",
        "runtime test",
        "verify the function",
        "verify the implementation",
        "verify the code",
        "test the function",
        "test the implementation",
        "do not claim",
        "until passed is true"
    ];

    return verificationSignals.some((signal) =>
        userMessages.includes(signal)
    );
}

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
     * Determine this once from the user's request.
     *
     * If the user explicitly requested behavioral verification,
     * the agent cannot finish until run_javascript_test succeeds.
     */
    const behavioralVerificationRequired =
        requiresBehavioralVerification(messages);

    let behavioralVerificationPassed = false;

    addMessage(state, {
        role: "system",
        content: AGENT_SYSTEM_PROMPT
    });

    if (behavioralVerificationRequired) {
        addMessage(state, {
            role: "system",
            content:
                "This task explicitly requires behavioral JavaScript verification. " +
                "You must use run_javascript_test before claiming the task is complete. " +
                "A file being created successfully is not sufficient. " +
                "The task cannot be considered verified until run_javascript_test returns passed: true."
        });
    }

    try {
        /*
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
                toolArguments: message.toolArguments ?? null,
                toolResult: message.toolResult ?? null
            });
        }

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

        while (state.iteration < MAX_ITERATIONS) {
            incrementIteration(state);

            const request = createAgentModelRequest({
                messages: state.messages,
                tools,
                toolChoice: "auto",
                temperature: 0.2,
                maxTokens: 8192
            });

            const rawResult = await executeWithFallback({
                models,
                messages: request.messages,
                tools: request.tools,
                toolChoice: request.toolChoice,
                temperature: request.temperature,
                maxTokens: request.maxTokens
            });

            const result = normalizeAgentModelResult(rawResult);

            console.log(
                `[ForgeAI Agent] Iteration ${state.iteration}`,
                JSON.stringify(
                    {
                        provider: result.provider,
                        model: result.model,
                        content: result.content,
                        toolCalls: result.toolCalls
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
             * =====================================================
             * COMPLETION GATE
             * =====================================================
             *
             * Normally, a model response without tool calls means
             * the agent has finished.
             *
             * However, if the user explicitly required behavioral
             * verification, we must prevent premature completion.
             */
            if (!result.toolCalls || result.toolCalls.length === 0) {
                if (
                    behavioralVerificationRequired &&
                    !behavioralVerificationPassed
                ) {
                    const verificationRequiredMessage =
                        "The task explicitly requires behavioral JavaScript verification, " +
                        "but run_javascript_test has not successfully passed yet. " +
                        "Do not finish the task. " +
                        "Use run_javascript_test on the relevant JavaScript function " +
                        "with representative inputs. " +
                        "If the test fails, inspect the actual result, repair the implementation, " +
                        "and run run_javascript_test again. " +
                        "You may only claim completion after passed: true.";

                    addMessage(state, {
                        role: "system",
                        content: verificationRequiredMessage
                    });

                    console.log(
                        "[ForgeAI Agent] Completion blocked:",
                        verificationRequiredMessage
                    );

                    /*
                     * Continue the agent loop instead of completing.
                     */
                    continue;
                }

                await createMessage({
                    conversationId,
                    role: "assistant",
                    content: result.content ?? ""
                });

                completeAgentState(state, "completed");

                await updateAgentRun({
                    runId,
                    conversationId,
                    data: {
                        status: "completed",
                        provider: result.provider,
                        model: result.model,
                        completedAt: new Date()
                    }
                });

                return {
                    state,
                    result
                };
            }

            /*
             * Persist the assistant's tool calls.
             */
            for (const toolCall of result.toolCalls) {
                await createMessage({
                    conversationId,
                    role: "assistant",
                    content: result.content ?? "",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    toolArguments: toolCall.arguments
                });
            }

            /*
             * Execute each requested tool exactly once.
             */
            for (const toolCall of result.toolCalls) {
                /*
                 * Validate the model-generated tool call before
                 * executing anything.
                 */
                const validatedToolCall =
                    validateToolCall(toolCall);

                const toolCallKey = JSON.stringify({
                    name: validatedToolCall.name,
                    arguments: validatedToolCall.arguments
                });

                const previousCount =
                    toolCallHistory.get(toolCallKey) ?? 0;

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
                if (currentCount > MAX_IDENTICAL_TOOL_CALLS) {
                    const error = new Error(
                        `Agent repeated the same tool call too many times: ${validatedToolCall.name}`
                    );

                    error.code = "REPEATED_TOOL_CALL";
                    error.statusCode = 503;

                    throw error;
                }

                recordToolCall(state, {
                    id: validatedToolCall.id,
                    name: validatedToolCall.name,
                    input: validatedToolCall.arguments,
                    iteration: state.iteration
                });

                let toolResult;

                try {
                    toolResult = await executeTool(
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

                    recordError(state, toolError);
                }

                /*
                 * =====================================================
                 * VERIFICATION / EXECUTION FEEDBACK
                 * =====================================================
                 */

                if (
                    validatedToolCall.name === "verify_javascript" ||
                    validatedToolCall.name === "run_javascript_test"
                ) {
                    const verificationPassed =
                        validatedToolCall.name ===
                        "run_javascript_test"
                            ? toolResult?.passed === true
                            : toolResult?.verified === true;

                    if (
                        validatedToolCall.name ===
                        "run_javascript_test"
                    ) {
                        if (verificationPassed) {
                            behavioralVerificationPassed = true;
                        }
                    }

                    const verificationStatus =
                        verificationPassed
                            ? validatedToolCall.name ===
                              "run_javascript_test"
                                ? "JavaScript behavioral test passed. The function produced the expected result."
                                : "JavaScript structural verification passed."
                            : validatedToolCall.name ===
                              "run_javascript_test"
                                ? "JavaScript behavioral test failed. Inspect the actual result, determine the root cause, repair the relevant file, and run the behavioral test again."
                                : "JavaScript structural verification failed. Inspect the verification result and repair the file if necessary.";

                    addMessage(state, {
                        role: "system",
                        content: verificationStatus
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
                 * =====================================================
                 * TRACK FILE CHANGES
                 * =====================================================
                 */

                if (
                    validatedToolCall.name === "write_file" &&
                    toolResult?.success &&
                    toolResult?.file?.path
                ) {
                    recordFileChange(
                        state,
                        toolResult.file.path
                    );
                }

                /*
                 * =====================================================
                 * TRACK VERIFICATION RESULTS
                 * =====================================================
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
                 * =====================================================
                 * TRACK JAVASCRIPT EXECUTION
                 * =====================================================
                 */

                if (
                    validatedToolCall.name ===
                    "execute_javascript"
                ) {
                    recordExecutionResult(
                        state,
                        toolResult
                    );
                }

                if (
                    validatedToolCall.name ===
                    "execute_javascript"
                ) {
                    const executionStatus =
                        toolResult?.success &&
                        toolResult?.exitCode === 0 &&
                        !toolResult?.timeOut
                            ? "JavaScript execution succeeded. The program ran successfully."
                            : "JavaScript execution failed. Inspect stdout and stderr, determine the cause, repair the relevant file, and execute it again.";

                    addMessage(state, {
                        role: "system",
                        content: executionStatus
                    });

                    console.log(
                        "[ForgeAI Agent] Execution status:",
                        executionStatus
                    );
                }

                /*
                 * =====================================================
                 * PERSIST TOOL RESULT
                 * =====================================================
                 */

                const serializedToolResult =
                    JSON.stringify(toolResult);

                await createMessage({
                    conversationId,
                    role: "tool",
                    content: serializedToolResult,
                    toolCallId: validatedToolCall.id,
                    toolName: validatedToolCall.name,
                    toolResult
                });

                /*
                 * Add the tool result back into the agent's
                 * in-memory conversation so the next model
                 * iteration can reason over it.
                 */
                addMessage(state, {
                    role: "tool",
                    toolCallId: validatedToolCall.id,
                    toolName: validatedToolCall.name,
                    content: serializedToolResult
                });

                /*
                 * =====================================================
                 * EXPLICIT TOOL STATUS FOR THE MODEL
                 * =====================================================
                 */

                let toolStatus;

                if (
                    validatedToolCall.name ===
                    "run_javascript_test"
                ) {
                    if (toolResult?.passed === true) {
                        toolStatus =
                            "JavaScript behavioral test passed. The actual function output matches the expected result. This is valid behavioral verification.";
                    } else {
                        toolStatus =
                            "JavaScript behavioral test failed. The function did not produce the expected result or the test could not complete. Inspect the test result, determine the root cause, repair the relevant file, and run run_javascript_test again. Do not claim the JavaScript implementation is verified until passed is true.";
                    }
                } else if (
                    validatedToolCall.name ===
                    "verify_javascript"
                ) {
                    toolStatus = toolResult?.verified
                        ? "JavaScript structural verification passed. This confirms the expected structure was found, but it does not prove runtime behavior."
                        : "JavaScript structural verification failed. Inspect the verification result, repair the relevant file, and run verification again.";
                } else {
                    toolStatus = toolResult?.success
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
         * The agent reached the safety iteration limit.
         */
        const error = new Error(
            `Agent exceeded maximum iterations (${MAX_ITERATIONS})`
        );

        error.code = "MAX_AGENT_ITERATIONS";
        error.statusCode = 503;

        throw error;
    } catch (error) {
        recordError(state, error);

        completeAgentState(state, "failed");

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