import {generateGemini} from "./adapters/gemini.js";
import {generateGroq} from "./adapters/groq.js";
import {generateCerebras} from "./adapters/cerebras.js";
import {generateOpenRouter} from "./adapters/openrouter.js";
import {generateMistral} from "./adapters/mistral.js";

import {createProviderAdapter} from "./providerInterface.js";

const adapters = new Map([
    [
        "gemini",
        createProviderAdapter({
            id: "gemini",
            generate: generateGemini
        })
    ],

    [
        "groq",
        createProviderAdapter({
            id: "groq",
            generate: generateGroq
        })
    ],

    [
        "cerebras",
        createProviderAdapter({
            id: "cerebras",
            generate: generateCerebras
        })
    ],

    [
        "openrouter",
        createProviderAdapter({
            id: "openrouter",
            generate: generateOpenRouter
        })
    ],

    [
        "mistral",
        createProviderAdapter({
            id: "mistral",
            generate: generateMistral
        })
    ]
]);

export function getProviderAdapter(
    provider
) {
    return adapters.get(provider);
}

export function registerProviderAdapter(
    provider,
    generate
) {
    adapters.set(
        provider,
        createProviderAdapter({
            id: provider,
            generate
        })
    );
}

export async function executeProvider({
    provider,
    model,
    messages,
    temperature,
    maxTokens
}) {
    const adapter =
        getProviderAdapter(provider);

    if (!adapter) {
        const error = new Error(
            `No adapter registered for provider: ${provider}`
        );

        error.code =
            "PROVIDER_ADAPTER_NOT_FOUND";

        error.provider = provider;

        throw error;
    }

    return adapter.generate({
        model,
        messages,
        temperature,
        maxTokens
    });
}