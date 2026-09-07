import { generateGemini } from "./adapters/gemini.js";
import { generateGroq } from "./adapters/groq.js";
import { generateCerebras } from "./adapters/cerebras.js";
import { generateOpenRouter } from "./adapters/openrouter.js";

const adapters = {
    gemini: generateGemini,
    groq: generateGroq,
    cerebras: generateCerebras,
    openrouter: generateOpenRouter
};

export async function executeProvider({
    provider, model, messages, temperature, maxTokens
}) {
    const adapter = adapters[provider];

    if (!adapter) {
        const error = new Error(`No adapter registered for provider: ${provider}`);

        error.code = PROVIDER_ADAPTER_NOT_FOUND;
        error.provider = provider;

        throw error;
    }

    return adapter({
        model,
        messages,
        temperature,
        maxTokens
    });
}