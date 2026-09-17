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