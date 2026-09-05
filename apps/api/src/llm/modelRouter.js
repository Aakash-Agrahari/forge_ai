import { providers } from "./providers.js";

export function getAvailableProviders(){
    return providers
        .filter((provider) => provider.enabled)
        .sort((a,b) => a.priority - b.priority);
}

export function selectProvider(){
    const availableProviders = getAvailableProviders();

    if(availableProviders.length === 0){
        const error = new Error(
            "No  LLM providers are currently configured"
        );

        error.code = "NO_LLM_PROVIDERS";
        error.statusCode = 503;

        throw error;
    }

    return availableProviders[0];
}