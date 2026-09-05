export const providers = [
    {
        name: "gemini",
        enabled: Boolean(process.env.GEMINI_API_KEY),
        models:[
            "gemini-3.5-flash-lite"
        ],
        priority: 1
    },

    {
        name: "groq",
        enabled: Boolean(process.env.GROQ_API_KEY),
        models: [
            "llama-3.3-70b-versatile"
        ],
        priority: 2
    },

    {
        name: "cerebras",
        enabled: Boolean(process.env.CEREBRAS_API_KEY),
        models: [
            "cerebras-gpt-13b"
        ],
        priority: 3
    },

    {
        name: "openrouter",
        enabled: Boolean(process.env.OPENROUTER_API_KEY),
        models: [
            "openrouter/free"
        ],
        priority: 4
    }
];