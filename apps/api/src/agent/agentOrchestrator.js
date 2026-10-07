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

    addMessage(state, {
        role: "system",
        content: AGENT_SYSTEM_PROMPT
    });

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

            // If the model has finished without requesting a tool, the agent run is complete.
            if (!result.toolCalls || result.toolCalls.length === 0) {
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

            // Persist the assistant's tool calls.
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

            // Execute each requested tool exactly once.
            for (const toolCall of result.toolCalls) {
                // Validate the model-generated tool call before executing anything.
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

                // Prevent the model from endlessly repeating exactly the same operation.
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
                 * ==========================================
                 * VERIFICATION / EXECUTION FEEDBACK
                 * ==========================================
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
                                    toolResult?.passed === true
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
                        toolResult?.verified === true;

                    const verificationStatus =
                        verificationPassed
                            ? "JavaScript structural verification passed."
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
                 * ==========================================
                 * TRACK FILE CHANGES
                 * ==========================================
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
                 * ==========================================
                 * TRACK VERIFICATION RESULTS
                 * ==========================================
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
                 * ==========================================
                 * TRACK JAVASCRIPT EXECUTION
                 * ==========================================
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
                        content: executionStatus
                    });

                    console.log(
                        "[ForgeAI Agent] Execution status:",
                        executionStatus
                    );
                }

                /*
                 * ==========================================
                 * PERSIST TOOL RESULT
                 * ==========================================
                 */

                const serializedToolResult =
                    JSON.stringify(toolResult);

                await createMessage({
                    conversationId,
                    role: "tool",
                    content: serializedToolResult,
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
                 * ==========================================
                 * EXPLICIT TOOL STATUS FOR THE MODEL
                 * ==========================================
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

        // The agent reached the safety iteration limit.
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