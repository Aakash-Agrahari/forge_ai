import { providers } from "./providers.js";

export function getConfiguredProviders() {
    return providers
        .filter((provider) => {
            if (provider.id === "cloudflare") {
                return Boolean(
                    process.env.CLOUDFLARE_API_TOKEN &&
                    process.env.CLOUDFLARE_ACCOUNT_ID
                );
            }

            return Boolean(process.env[provider.envKey]);
        })
        .sort((a, b) => a.priority - b.priority);
}

export function selectProvider() {
    const availableProviders = getConfiguredProviders();

    if (availableProviders.length === 0) {
        const error = new Error(
            "No LLM providers are currently configured"
        );

        error.code = "NO_LLM_PROVIDERS";
        error.statusCode = 503;

        throw error;
    }

    return availableProviders[0];
}