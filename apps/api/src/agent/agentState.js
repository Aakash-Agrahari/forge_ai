export function createAgentState({
    runId,
    projectId,
    conversationId
}) {
    return {
        runId,
        projectId,
        conversationId,

        status: "running",

        iteration: 0,

        messages: [],

        toolCalls: [],

        filesChanged: [],

        errors: [],

        startedAt: new Date().toISOString(),

        completedAt: null
    };
}

export function incrementIteration(state) {
    state.iteration += 1;

    return state;
}

export function addMessage(state, message) {
    state.messages.push(message);

    return state;
}

export function recordToolCall(state, toolCall) {
    state.toolCalls.push({
        ...toolCall,
        timestamp: new Date().toISOString()
    });

    return state;
}

export function recordFileChange(state, file) {
    if (!state.filesChanged.includes(file)) {
        state.filesChanged.push(file);
    }

    return state;
}

export function recordError(state, error) {
    state.errors.push({
        message: error.message,
        code: error.code ?? null,
        timestamp: new Date().toISOString()
    });

    return state;
}

export function completeAgentState(
    state,
    status = "completed"
) {
    state.status = status;

    state.completedAt =
        new Date().toISOString();

    return state;
}