export function createExecutionBackend({
    name, execute
}) {
    if(!name){
        throw new Error("Execution backend requires a name");
    }

    if(typeof execute !== "function"){
        throw new Error(`Execution backend "${name}" requires an execute function`);
    }

    return {
        name, execute
    };
}