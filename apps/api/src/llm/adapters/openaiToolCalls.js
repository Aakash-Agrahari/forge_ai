export function normalizeOpenAIToolCalls(message){
    if(!Array.isArray(message?.tool_calls)){
        return[];
    }
    return message.tool_calls.map((toolCall) => ({
        id: toolCall.id ?? null,

        name: toolCall.function?.name ?? null,

        arguments: toolCall.function?.arguments ?? "{}"
    }));
}  

export function convertToolsToOpenAIFormat(tools){
    if(!Array.isArray(tools) || tools.length === 0){
        return [];
    }

    return tools.map((tool) => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
        }
    }));
}