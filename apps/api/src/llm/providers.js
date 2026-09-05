export const providers = [
    {
        id: "gemini",
        name: "Google Gemini",
        envKey: "GEMINI_API_KEY",
        priority: 10,
        discovery: "dynamic"
    },

    {
        id: "groq",
        name: "Groq",
        envKey: "GROQ_API_KEY",
        priority: 20,
        discovery: "dynamic"
    },

    {
        id: "cerebras",
        name: "Cerebras",
        envKey: "CEREBRAS_API_KEY",
        priority: 30,
        discovery: "dynamic"
    },

    {
        id: "openrouter",
        name: "OpenRouter",
        envKey: "OPENROUTER_API_KEY",
        priority: 40,
        discovery: "dynamic"
    },

    {
        id: "mistral",
        name: "Mistral",
        envKey: "MISTRAL_API_KEY",
        priority: 50,
        discovery: "dynamic"
    },

    {
        id: "cloudflare",
        name: "Cloudflare Workers AI",
        envKey: "CLOUDFLARE_API_TOKEN",
        priority: 60,
        discovery: "dynamic"
    },

    {
        id: "cohere",
        name: "Cohere",
        envKey: "COHERE_API_KEY",
        priority: 70,
        discovery: "dynamic"
    },

    {
        id: "nvidia",
        name: "NVIDIA NIM",
        envKey: "NVIDIA_API_KEY",
        priority: 80,
        discovery: "dynamic"
    },

    {
        id: "huggingface",
        name: "Hugging Face",
        envKey: "HUGGINGFACE_API_KEY",
        priority: 90,
        discovery: "dynamic"
    },

    {
        id: "sambanova",
        name: "SambaNova",
        envKey: "SAMBANOVA_API_KEY",
        priority: 100,
        discovery: "dynamic"
    },

    {
        id: "zai",
        name: "Z.ai",
        envKey: "ZAI_API_KEY",
        priority: 110,
        discovery: "dynamic"
    }
];