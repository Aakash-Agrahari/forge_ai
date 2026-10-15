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

function normalizeToolArguments(argumentsValue) {
    if (
        argumentsValue === null ||
        argumentsValue === undefined
    ) {
        return "{}";
    }

    if (typeof argumentsValue === "string") {
        const trimmed = argumentsValue.trim();

        if (!trimmed) {
            return "{}";
        }

        // The provider already returned JSON text.
        // Do not JSON.stringify it again.
        try {
            JSON.parse(trimmed);
            return trimmed;
        } catch {
            // If it is not valid JSON, safely convert it
            // into a JSON string so the provider receives
            // valid function.arguments.
            return JSON.stringify(argumentsValue);
        }
    }

    // Internal tool calls may contain an object.
    // Convert the object exactly once to JSON text.
    try {
        return JSON.stringify(argumentsValue);
    } catch {
        return "{}";
    }
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
                result.tool_calls = message.toolCalls.map(
                    (toolCall) => ({
                        id: toolCall.id,

                        type: "function",

                        function: {
                            name: toolCall.name,

                            arguments:
                                normalizeToolArguments(
                                    toolCall.arguments
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