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

    try {
        // 1. Save incoming user messages
        for (const message of messages) {
            addMessage(state, message);

            await createMessage({
                conversationId,
                role: message.role,
                content: message.content ?? ""
            });
        }

        // 2. Mark AgentRun as running
        await updateAgentRun({
            runId,
            conversationId,
            data: {
                status: "running"
            }
        });

        // 3. Get available agent tools
        const tools = getAgentTools();

        // 4. Select eligible models
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

        // 5. Agent loop
        while (state.iteration < MAX_ITERATIONS) {
            incrementIteration(state);

            const request = createAgentModelRequest({
                messages: state.messages,
                tools,
                toolChoice: "auto",
                temperature: 0.2,
                maxTokens: 8192
            });

            // 6. Execute model with fallback
            const rawResult = await executeWithFallback({
                models,
                messages: request.messages,
                tools: request.tools,
                toolChoice: request.toolChoice,
                temperature: request.temperature,
                maxTokens: request.maxTokens
            });

            const result = normalizeAgentModelResult(
                rawResult
            );

            // 7. Add assistant response to in-memory state
            addMessage(state, {
                role: "assistant",
                content: result.content,
                toolCalls: result.toolCalls,
                provider: result.provider,
                model: result.model
            });

            // 8. Persist assistant message
            if (
                !result.toolCalls ||
                result.toolCalls.length === 0
            ) {
                // Normal assistant response
                await createMessage({
                    conversationId,
                    role: "assistant",
                    content: result.content ?? ""
                });
            } else {
                // Assistant response containing tool calls
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

            // 9. If there are no tool calls, agent is finished
            if (
                !result.toolCalls ||
                result.toolCalls.length === 0
            ) {
                completeAgentState(
                    state,
                    "completed"
                );

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

            // 10. Execute each tool call
            for (const toolCall of result.toolCalls) {
                if (!toolCall.name) {
                    const error = new Error(
                        "Model returned a tool call without a tool name"
                    );

                    error.code = "INVALID_TOOL_CALL";

                    throw error;
                }

                // Record tool call in agent state
                recordToolCall(state, {
                    id: toolCall.id,
                    name: toolCall.name,
                    input: toolCall.arguments,
                    iteration: state.iteration
                });

                // Execute tool
                const toolResult = await executeTool(
                    toolCall.name,
                    toolCall.arguments,
                    {
                        projectId,
                        conversationId,
                        runId
                    }
                );

                // 11. Track changed files
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

                // 12. Persist tool result
                await createMessage({
                    conversationId,
                    role: "tool",
                    content: JSON.stringify(toolResult),
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    toolResult
                });

                // 13. Add tool result to in-memory state
                addMessage(state, {
                    role: "tool",
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    content: JSON.stringify(toolResult)
                });
            }
        }

        // 14. Maximum iterations exceeded
        const error = new Error(
            `Agent exceeded maximum iterations (${MAX_ITERATIONS})`
        );

        error.code = "MAX_AGENT_ITERATIONS";
        error.statusCode = 503;

        throw error;

    } catch (error) {

        // 15. Record failure in agent state
        recordError(
            state,
            error
        );

        completeAgentState(
            state,
            "failed"
        );

        // 16. Persist failure in AgentRun
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