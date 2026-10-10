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

        // Agent lifecycle state
        phase: "queued",

        // Execution counters
        iteration: 0,
        toolCount: 0,

        // Currently executing tool
        currentTool: null,

        // Runtime heartbeat
        lastHeartbeatAt: new Date().toISOString(),

        messages: [],

        toolCalls: [],

        verificationResults: [],

        executionResults: [],

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


export function setAgentPhase(state, phase) {
    state.phase = phase;

    return state;
}


export function setCurrentTool(state, toolName) {
    state.currentTool = toolName;

    return state;
}


export function recordToolExecution(state) {
    state.toolCount += 1;

    return state;
}


export function heartbeatAgentState(state) {
    state.lastHeartbeatAt = new Date().toISOString();

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


export function recordVerificationResult(state, result) {
    state.verificationResults.push({
        verified: result?.verified ?? false,
        filePath: result?.filePath ?? null,
        functionName: result?.functionName ?? null,
        expectedReturn: result?.expectedReturn ?? null,
        functionFound: result?.functionFound ?? false,
        expectedReturnFound: result?.expectedReturnFound ?? false,
        message: result?.message ?? null,
        reason: result?.reason ?? null,
        iteration: state.iteration
    });

    return state;
}


export function recordExecutionResult(state, result) {
    state.executionResults.push({
        success: result?.success ?? false,
        filePath: result?.filePath ?? null,
        exitCode: result?.exitCode ?? null,
        stdout: result?.stdout ?? "",
        stderr: result?.stderr ?? "",
        durationMs: result?.durationMs ?? null,
        timeOut: result?.timeOut ?? false,
        iteration: state.iteration
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

    state.currentTool = null;

    return state;
}