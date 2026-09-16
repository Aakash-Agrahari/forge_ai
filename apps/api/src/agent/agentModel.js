export function normalizeAgentModelResult(result){
    return {
        provider: result.provider,
        model: result.model,
        content: result.content ?? "",
        toolCalls: [],

        usage: result.usage ?? {
            inputTokens: null,
            outputTokens: null,
            totalTokens: null
        },

        finishReason : result.finishReason ?? null,

        raw: result.raw ?? null,

        fallback: result.fallback ?? null
    };
}