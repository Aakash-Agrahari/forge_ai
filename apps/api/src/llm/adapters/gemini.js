import { createProviderError } from "../providerError.js";

const GEMINI_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateGemini({
    model,
    messages,
    tools = [],
    toolChoice = "auto",
    temperature = 0.2,
    maxTokens = 8192
}) {
    const apiKey =
        process.env.GEMINI_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "GEMINI_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";
        error.provider = "gemini";

        throw error;
    }

    const systemMessages =
        messages.filter(
            (message) =>
                message.role === "system"
        );

    const conversationMessages =
        messages.filter(
            (message) =>
                message.role !== "system"
        );

    const systemInstruction =
        systemMessages.length > 0
            ? {
                parts: systemMessages.map(
                    (message) => ({
                        text: message.content
                    })
                )
            }
            : undefined;

    const contents =
        conversationMessages.map(
            (message) => {
                if (message.role === "assistant") {
                    const parts = [];

                    if (message.content) {
                        parts.push({
                            text: message.content
                        });
                    }

                    if (
                        Array.isArray(
                            message.toolCalls
                        )
                    ) {
                        for (
                            const toolCall
                            of message.toolCalls
                        ) {
                            parts.push({
                                functionCall: {
                                    name:
                                        toolCall.name,
                                    args:
                                        toolCall.arguments ??
                                        {}
                                }
                            });
                        }
                    }

                    return {
                        role: "model",
                        parts
                    };
                }

                if (message.role === "tool") {
                    let toolResult = {};

                    try {
                        toolResult =
                            typeof message.content ===
                            "string"
                                ? JSON.parse(
                                    message.content
                                )
                                : message.content ?? {};
                    } catch {
                        toolResult = {
                            result:
                                message.content
                        };
                    }

                    return {
                        role: "user",
                        parts: [
                            {
                                functionResponse: {
                                    name:
                                        normalizeGeminiToolName(
                                            message.toolName
                                        ),
                                    response:
                                        toolResult
                                }
                            }
                        ]
                    };
                }

                return {
                    role: "user",
                    parts: [
                        {
                            text:
                                message.content ?? ""
                        }
                    ]
                };
            }
        );

    const requestBody = {
        contents,

        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens
        }
    };

    if (systemInstruction) {
        requestBody.systemInstruction =
            systemInstruction;
    }

    if (
        Array.isArray(tools) &&
        tools.length > 0
    ) {
        requestBody.tools = [
            {
                functionDeclarations:
                    tools.map((tool) => ({
                        name: tool.name,

                        description:
                            tool.description,

                        parameters:
                            convertToolSchemaForGemini(
                                tool.inputSchema
                            )
                    }))
            }
        ];
    }

    const response =
        await fetch(
            `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        requestBody
                    )
            }
        );

    if (!response.ok) {
        const responseBody =
            await response.text();

        throw createProviderError({
            provider: "gemini",
            model,
            response,
            responseBody
        });
    }

    const data =
        await response.json();

    const parts =
        data.candidates?.[0]
            ?.content?.parts ?? [];

    const textParts =
        parts
            .filter(
                (part) =>
                    typeof part.text ===
                    "string"
            )
            .map(
                (part) =>
                    part.text
            );

    const functionCalls =
        parts
            .filter(
                (part) =>
                    part.functionCall
            )
            .map(
                (part) => ({
                    id:
                        part.functionCall.id ??
                        null,

                    name:
                        normalizeGeminiToolName(
                            part.functionCall.name
                        ),

                    arguments:
                        part.functionCall.args ??
                        {}
                })
            );

    return {
        provider: "gemini",

        model,

        content:
            textParts.join(""),

        toolCalls:
            functionCalls,

        usage: {
            inputTokens:
                data.usageMetadata
                    ?.promptTokenCount ??
                null,

            outputTokens:
                data.usageMetadata
                    ?.candidatesTokenCount ??
                null,

            totalTokens:
                data.usageMetadata
                    ?.totalTokenCount ??
                null
        },

        finishReason:
            data.candidates?.[0]
                ?.finishReason ??
            null,

        raw: data
    };
}

function normalizeGeminiToolName(name) {
    if (
        typeof name !== "string"
    ) {
        return name;
    }

    if (
        name.startsWith("mcp__")
    ) {
        const parts =
            name.split("__");

        return parts[parts.length - 1];
    }

    return name;
}

function convertToolSchemaForGemini(schema) {
    if (!schema || typeof schema !== "object") {
        return schema;
    }

    const result = {};

    for (const [key, value] of Object.entries(schema)) {

        //Gemini does not accept additionalProperties in this function declaration schema.
         
        if (key === "additionalProperties") {
            continue;
        }

        if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        ) {
            result[key] =
                convertToolSchemaForGemini(
                    value
                );

            continue;
        }

        if (Array.isArray(value)) {
            result[key] =
                value.map((item) =>
                    item &&
                    typeof item === "object"
                        ? convertToolSchemaForGemini(
                            item
                        )
                        : item
                );

            continue;
        }

        result[key] = value;
    }

    return result;
}