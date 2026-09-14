export function createTool({
    name, description, inputSchema, execute
}) {
    if(!name){
        throw new Error("Tool requires a name");
    }

    if(!description){
        throw new Error(`Tool "${name}" requires a description`);
    }

    if(!inputSchema){
        throw new Error(`Tool "${name}" requires an input schema`);
    }

    if(typeof execute !== "function"){
        throw new Error(`Tool "${name}" requires an execute function`);
    }
        
    return {
        name,
        description,
        inputSchema,
        execute
    };
}