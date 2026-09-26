import {
    createAgentState,
    incrementIteration,
    addMessage,
    recordToolCall,
    recordFileChange,
    recordError,
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

const MAX_ITERATIONS = 10;

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

            addMessage(state, {
                role: "assistant",
                content: result.content,
                toolCalls: result.toolCalls,
                provider: result.provider,
                model: result.model
            });

            if (!result.toolCalls || result.toolCalls.length === 0) {
                await createMessage({
                    conversationId,
                    role: "assistant",
                    content: result.content ?? ""
                });
            } else {
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
            }

            if (!result.toolCalls || result.toolCalls.length === 0) {
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

            for (const toolCall of result.toolCalls) {
                if (!toolCall.name) {
                    const error = new Error(
                        "Model returned a tool call without a tool name"
                    );

                    error.code = "INVALID_TOOL_CALL";

                    throw error;
                }

                recordToolCall(state, {
                    id: toolCall.id,
                    name: toolCall.name,
                    input: toolCall.arguments,
                    iteration: state.iteration
                });

                const toolResult = await executeTool(
                    toolCall.name,
                    toolCall.arguments,
                    {
                        projectId,
                        conversationId,
                        runId
                    }
                );

                if (
                    toolCall.name === "write_file" &&
                    toolResult?.success &&
                    toolResult?.file?.path
                ) {
                    recordFileChange(
                        state,
                        toolResult.file.path
                    );
                }

                await createMessage({
                    conversationId,
                    role: "tool",
                    content: JSON.stringify(toolResult),
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    toolResult
                });

                addMessage(state, {
                    role: "tool",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    content: JSON.stringify(toolResult)
                });
            }
        }

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