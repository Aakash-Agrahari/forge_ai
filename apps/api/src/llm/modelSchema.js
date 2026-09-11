export function normalizeModel({
    id,
    name = id,
    provider,

    capabilities = {},

    modalities = {
        input: ["text"],
        output: ["text"]
    },

    tasks = [],

    contextWindow = null,

    availability = {},

    free = false,
    active = true,
    deprecated = false
}) {
    return {
        id,
        name,
        provider,

        capabilities: {
            toolCalling: capabilities.toolCalling ?? false,
            structuredOutput: capabilities.structuredOutput ?? false
        },

        modalities: {
            input: modalities.input ?? ["text"],
            output: modalities.output ?? ["text"]
        },

        tasks: [...new Set(tasks)],

        contextWindow,

        availability: {
            free: availability.free ?? free,
            active: availability.active ?? active,
            deprecated: availability.deprecated ?? deprecated
        }
    };
}