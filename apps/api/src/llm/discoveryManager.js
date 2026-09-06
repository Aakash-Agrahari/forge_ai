import {getConfiguredProviders} from "./modelRouter.js";
import {registerModels, clearModels} from "./modelCatalog.js";
import {discoverGroqModels} from "./discovery/groq.js";

const discoveryHandlers = {
    groq: discoverGroqModels
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