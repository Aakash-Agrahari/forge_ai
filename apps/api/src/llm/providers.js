export const providers = [
    {
        id: "gemini",
        name: "Google Gemini",
        envKey: "GEMINI_API_KEY",
        priority: 10,
        discovery: "dynamic",
        protocol: "gemini"
    },

    {
        id: "groq",
        name: "Groq",
        envKey: "GROQ_API_KEY",
        priority: 20,
        discovery: "dynamic",
        protocol: "openai"
    },

    {
        id: "cerebras",
        name: "Cerebras",
        envKey: "CEREBRAS_API_KEY",
        priority: 30,
        discovery: "dynamic",
        protocol: "openai"
    },

    {
        id: "openrouter",
        name: "OpenRouter",
        envKey: "OPENROUTER_API_KEY",
        priority: 40,
        discovery: "dynamic",
        protocol: "openai"
    },

    {
        id: "mistral",
        name: "Mistral",
        envKey: "MISTRAL_API_KEY",
        priority: 50,
        discovery: "dynamic",
        protocol: "openai"
    },

    {
        id: "cloudflare",
        name: "Cloudflare Workers AI",
        envKey: "CLOUDFLARE_API_TOKEN",
        priority: 60,
        discovery: "dynamic",
        protocol: "cloudflare"
    },

    {
        id: "cohere",
        name: "Cohere",
        envKey: "COHERE_API_KEY",
        priority: 70,
        discovery: "static_fallback",
        protocol: "cohere"
    },

    {
        id: "nvidia",
        name: "NVIDIA NIM",
        envKey: "NVIDIA_API_KEY",
        priority: 80,
        discovery: "dynamic",
        protocol: "openai"
    },

    {
        id: "huggingface",
        name: "Hugging Face",
        envKey: "HUGGINGFACE_API_KEY",
        priority: 90,
        discovery: "dynamic",
        protocol: "huggingface"
    },

    {
        id: "sambanova",
        name: "SambaNova",
        envKey: "SAMBANOVA_API_KEY",
        priority: 100,
        discovery: "dynamic",
        protocol: "openai"
    },

    {
        id: "zai",
        name: "Z.ai",
        envKey: "ZAI_API_KEY",
        priority: 110,
        discovery: "static_fallback",
        protocol: "openai"
    }
];