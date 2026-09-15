import {
    createAgentState,
    incrementIteration,
    addMessage,
    recordToolCall,
    recordError,
    completeAgentState
} from "./agentState.js";

import {
    executeTool
} from "./toolRegistery.js";

export async function runAgent({
    runId,
    projectId,
    conversationId,
    messages
}) {
    const state =
        createAgentState({
            runId,
            projectId,
            conversationId
        });

    try {
        
        //Initialize conversation
        for (const message of messages) {
            addMessage(state, message);
        }

        // Start first agent iteration
        incrementIteration(state);

        //Temporary tool execution test - This is intentionally temporary.Later the LLM will decide which tool to call.
        const toolName = "list_files";

        const toolInput = {};

        recordToolCall(state, {
            name: toolName,
            input: toolInput,
            iteration: state.iteration
        });

        const toolResult =
            await executeTool(
                toolName,
                toolInput,
                {
                    projectId,
                    conversationId,
                    runId
                }
            );

        //Store tool result
        addMessage(state, {
            role: "tool",
            toolName,
            content: JSON.stringify(
                toolResult
            )
        });

        //Complete temporary run
        completeAgentState(
            state,
            "completed"
        );

        return {
            state,
            result: toolResult
        };

    } catch (error) {
        recordError(state, error);

        completeAgentState(
            state,
            "failed"
        );

        throw error;
    }
}