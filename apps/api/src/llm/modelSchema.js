export function normalizeModel({
    id,
    name = id,
    provider,
    capabilities = {},
    contextWindow = null,
    free = false,
    active = true
}) {
    return {
        id,
        name,
        provider,
        capabilities: {
            text: capabilities.text ?? true,
            code: capabilities.code ?? false,
            vision: capabilities.vision ?? false,
            toolCalling: capabilities.toolCalling ?? false,
            structuredOutput: capabilities.structuredOutput ?? false
        },
        contextWindow,
        free,
        active
    }
}