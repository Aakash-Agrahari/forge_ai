import {
    createAgentState,
    incrementIteration
} from "./agentState.js";

import {
    executeTool
} from "./toolRegistry.js";

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

    state.messages = [
        ...messages
    ];

    incrementIteration(state);

    return {
        state
    };
}