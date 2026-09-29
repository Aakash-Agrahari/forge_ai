import { getTool } from "./toolRegistery.js";

export function validateToolCall(toolCall) {
    if (!toolCall || typeof toolCall !== "object") {
        const error = new Error(
            "Invalid tool call: tool call must be an object"
        );

        error.code = "INVALID_TOOL_CALL";

        throw error;
    }

    if (!toolCall.name || typeof toolCall.name !== "string") {
        const error = new Error(
            "Invalid tool call: tool name is required"
        );

        error.code = "INVALID_TOOL_NAME";

        throw error;
    }

    const tool = getTool(toolCall.name);

    if (!tool) {
        const error = new Error(
            `Unknown tool: ${toolCall.name}`
        );

        error.code = "UNKNOWN_TOOL";
        error.toolName = toolCall.name;

        throw error;
    }

    let argumentsValue = toolCall.arguments;

    if (typeof argumentsValue === "string") {
        try {
            argumentsValue = JSON.parse(argumentsValue);
        } catch {
            const error = new Error(
                `Invalid JSON arguments for tool: ${toolCall.name}`
            );

            error.code = "INVALID_TOOL_ARGUMENTS";
            error.toolName = toolCall.name;

            throw error;
        }
    }

    if (
        argumentsValue === null ||
        typeof argumentsValue !== "object" ||
        Array.isArray(argumentsValue)
    ) {
        const error = new Error(
            `Tool arguments must be an object: ${toolCall.name}`
        );

        error.code = "INVALID_TOOL_ARGUMENTS";
        error.toolName = toolCall.name;

        throw error;
    }

    return {
        id: toolCall.id ?? null,
        name: toolCall.name,
        arguments: argumentsValue,
        tool
    };
}