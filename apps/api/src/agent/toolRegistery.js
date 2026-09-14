const tools = new Map();

export function registerTool(tool){
    if (!tool?.name){
        throw new Error("Tool registration requires a name");
    }

    if (typeof tool.execute !== "function"){
        throw new Error(`Tool "${tool.name}" requires an execute function`);
    }

    if(tools.has(tool.name)){
        throw new Error(`Tool "${tool.name}" is already registered`);
    }

    tools.set(tool.name, tool);

    return tool;
}

export function getTool(name){
    return tools.get(name);
}

export function getAllTools(){
    return [...tools.values()];
}

export function hasTool(name){
    return tools.has(name);
}

export async function executeTool(name, input, context={}){
    const tool = getTool(name);

    if(!tool){
        const error = new Error(`Unknown tool: ${name}`);

        error.code = "UNKNOWN_TOOL";
        throw error;
    }

    return tool.execute(input, context);
}

export function clearTools(){
    tools.clear();
}