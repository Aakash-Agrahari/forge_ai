//this files helps to create a provider adapter that can be used to interface with different LLM providers. It ensures that the adapter has a unique identifier and a generate function for generating responses from the provider.
export function createProviderAdapter({id, generate}) {
    if(!id){
        throw new Error("Provider adapter requires an id");
    }

    if(typeof generate !== "function"){
        throw new Error (`Provider adapter "${id}" requires a generate function`);
    }

    return {id, generate};
}