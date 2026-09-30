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

    validateRequiredArguments(
        tool,
        argumentsValue
    );

    return {
        id: toolCall.id ?? null,
        name: toolCall.name,
        arguments: argumentsValue,
        tool
    };
}

function validateRequiredArguments(tool, argumentsValue) {
    const required =
        tool.inputSchema?.required ?? [];

    for (const field of required) {
        if (
            argumentsValue[field] === undefined ||
            argumentsValue[field] === null
        ) {
            const error = new Error(
                `Missing required argument "${field}" for tool "${tool.name}"`
            );

            error.code = "MISSING_TOOL_ARGUMENT";
            error.toolName = tool.name;
            error.argument = field;

            throw error;
        }
    }

    const properties =
        tool.inputSchema?.properties ?? {};

    for (const [field, value] of Object.entries(argumentsValue)) {
        const definition = properties[field];

        if (!definition) {
            if (
                tool.inputSchema?.additionalProperties === false
            ) {
                const error = new Error(
                    `Unknown argument "${field}" for tool "${tool.name}"`
                );

                error.code = "UNKNOWN_TOOL_ARGUMENT";
                error.toolName = tool.name;
                error.argument = field;

                throw error;
            }

            continue;
        }

        if (
            definition.type === "string" &&
            typeof value !== "string"
        ) {
            const error = new Error(
                `Argument "${field}" for tool "${tool.name}" must be a string`
            );

            error.code = "INVALID_TOOL_ARGUMENT_TYPE";
            error.toolName = tool.name;
            error.argument = field;

            throw error;
        }

        if (
            definition.type === "object" &&
            (
                typeof value !== "object" ||
                value === null ||
                Array.isArray(value)
            )
        ) {
            const error = new Error(
                `Argument "${field}" for tool "${tool.name}" must be an object`
            );

            error.code = "INVALID_TOOL_ARGUMENT_TYPE";
            error.toolName = tool.name;
            error.argument = field;

            throw error;
        }

        if (
            definition.type === "boolean" &&
            typeof value !== "boolean"
        ) {
            const error = new Error(
                `Argument "${field}" for tool "${tool.name}" must be a boolean`
            );

            error.code = "INVALID_TOOL_ARGUMENT_TYPE";
            error.toolName = tool.name;
            error.argument = field;

            throw error;
        }

        if (
            definition.type === "number" &&
            typeof value !== "number"
        ) {
            const error = new Error(
                `Argument "${field}" for tool "${tool.name}" must be a number`
            );

            error.code = "INVALID_TOOL_ARGUMENT_TYPE";
            error.toolName = tool.name;
            error.argument = field;

            throw error;
        }
    }
}