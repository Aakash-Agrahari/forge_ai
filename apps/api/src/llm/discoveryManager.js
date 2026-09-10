import {getConfiguredProviders} from "./modelRouter.js";
import {registerModels, clearModels} from "./modelCatalog.js";
import {discoverGroqModels} from "./discovery/groq.js";
import {discoverGeminiModels} from "./discovery/gemini.js";
import {discoverCerebrasModels} from "./discovery/cerebras.js";
import {discoverOpenRouterModels} from "./discovery/openrouter.js";
import {discoverMistralModels} from "./discovery/mistral.js";
import {discoverNvidiaModels} from "./discovery/nvidia.js";
import {discoverHuggingFaceModels} from "./discovery/huggingface.js";
import {discoverCloudflareModels} from "./discovery/cloudflare.js";
import { discoverCohereModels } from "./discovery/cohere.js";
import { discoverSambaNovaModels } from "./discovery/sambanova.js";
import { discoverZaiModels } from "./discovery/zai.js";


const DISCOVERY_STRATEGIES = new set ([
    "dynamic",
    "static_fallback"
]);

const discoveryHandlers = {
    groq: discoverGroqModels,
    gemini: discoverGeminiModels,
    cerebras: discoverCerebrasModels,
    openrouter: discoverOpenRouterModels,
    mistral: discoverMistralModels,
    nvidia: discoverNvidiaModels,
    huggingface: discoverHuggingFaceModels,
    cloudflare: discoverCloudflareModels,
    cohere: discoverCohereModels,
    sambanova: discoverSambaNovaModels,
    zai: discoverZaiModels
};

export async function discoverAllModels(){
    clearModels();

    const configuredProviders = getConfiguredProviders();

    const results = [];

    for(const provider of configuredProviders){
        const handler = discoveryHandlers[provider.id];

        if(!handler){
            results.push({
                provider: provider.id,
                status: "not_implemented",
                models: []
            });
            continue;
        }

        try{
            const models = await handler();
            registerModels(provider.id, models);
            results.push({
                provider: provider.id,
                status: "success",
                models
            });
        } catch (error) {
            results.push({
                provider: provider.id,
                status: "failed",
                models: [],
                error: error.message
            });
        }
    }

    return results;
}