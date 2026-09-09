export function createProviderAdapter({id, generate}) {
    if(!id){
        throw new Error("Provider adapter requires an id");
    }

    if(typeof generate !== "function"){
        throw new Error (`Provider adapter "${id}" requires a generate function`);
    }

    return {id, generate};
}