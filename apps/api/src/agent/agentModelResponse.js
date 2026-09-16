export function createAgentModelResponse({
    provider,
    model,
    content,
    toolCalls = [],
    usage = null,
    finishReason = null,
    raw = null,
    fallback = null
}) {
    return {
        provider,
        model,
        content,
        toolCalls,
        usage,
        finishReason,
        raw,
        fallback
    };
}