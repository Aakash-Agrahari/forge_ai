export function normalizeAgentModelResult(result) {
    return {
        provider: result.provider,
        model: result.model,

        content: result.content ?? "",

        toolCalls: Array.isArray(result.toolCalls)
            ? result.toolCalls.map(normalizeToolCall)
            : [],

        usage: result.usage ?? {
            inputTokens: null,
            outputTokens: null,
            totalTokens: null
        },

        finishReason: result.finishReason ?? null,

        raw: result.raw ?? null,

        providerData: result.providerData ?? null,

        fallback: result.fallback ?? null
    };
}

function normalizeToolCall(toolCall) {
    return {
        id:
            toolCall.id ??
            toolCall.toolCallId ??
            null,

        name:
            toolCall.name ??
            toolCall.function?.name ??
            null,

        arguments:
            normalizeArguments(
                toolCall.arguments ??
                toolCall.function?.arguments ??
                {}
            ),

        providerData:
            toolCall.providerData ?? null
    };
}

function normalizeArguments(value) {
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return {
                raw: value
            };
        }
    }

    return value ?? {};
}
