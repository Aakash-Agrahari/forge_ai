
//this file will hold the model catalog where model catalog means the list of models available for each provider. This will be used to validate the model requested by the user and also to provide a list of available models for each provider.
const modelCatalog = new Map(); //this will hold the models for each provider

export function registerModels(provideId, models){
    modelCatalog.set(provideId, models);
}

export function getModels(provideId){
    return modelCatalog.get(providerId) || [];
}

export function getAllModels(){
    const result = [];
    for(const [providerId, models] of modelCatalog.entries()){
        for(const model of models){
            result.push({
                provider: providerId,
                ...model
            });
        }
    }
    return result;
}

export function clearModels(){
    modelCatalog.clear();
}