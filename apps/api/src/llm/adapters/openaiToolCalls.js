export function normalizeOpenAIToolCalls(message) {
    if (!Array.isArray(message?.tool_calls)) {
        return [];
    }

    return message.tool_calls.map((toolCall) => ({
        id: toolCall.id ?? null,

        name:
            toolCall.function?.name ??
            null,

        arguments:
            toolCall.function?.arguments ??
            "{}"
    }));
}


export function convertToolsToOpenAIFormat(tools) {
    if (!Array.isArray(tools) || tools.length === 0) {
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


export function convertMessagesToOpenAIFormat(messages) {
    if (!Array.isArray(messages)) {
        return [];
    }

    return messages.map((message) => {
        
        if (message.role === "user") {
            return {
                role: "user",
                content: message.content ?? ""
            };
        }

        if (message.role === "system") {
            return {
                role: "system",
                content: message.content ?? ""
            };
        }

        if (message.role === "assistant") {
            const result = {
                role: "assistant",
                content: message.content ?? ""
            };

            if (
                Array.isArray(message.toolCalls) &&
                message.toolCalls.length > 0
            ) {
                result.tool_calls =
                    message.toolCalls.map(
                        (toolCall) => ({
                            id:
                                toolCall.id,

                            type: "function",

                            function: {
                                name:
                                    toolCall.name,

                                arguments:
                                    JSON.stringify(
                                        toolCall.arguments ?? {}
                                    )
                            }
                        })
                    );
            }

            return result;
        }

        if (message.role === "tool") {
            return {
                role: "tool",

                tool_call_id:
                    message.toolCallId,

                content:
                    message.content ?? ""
            };
        }

        return {
            role: message.role,
            content: message.content ?? ""
        };
    });
}