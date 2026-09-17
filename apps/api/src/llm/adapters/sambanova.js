import { createProviderError } from "../providerError.js";

import {
    normalizeOpenAIToolCalls,
    convertToolsToOpenAIFormat
} from "./openaiToolCalls.js";

const SAMBANOVA_CHAT_URL =
    "https://api.sambanova.ai/v1/chat/completions";

export async function generateSambaNova({
    model,
    messages,
    tools = [],
    toolChoice = "auto",
    temperature = 0.2,
    maxTokens = 8192
}) {
    const apiKey =
        process.env.SAMBANOVA_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "SAMBANOVA_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";
        error.provider = "sambanova";

        throw error;
    }

    const requestBody = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens
    };

    const openAITools =
        convertToolsToOpenAIFormat(tools);

    if (openAITools.length > 0) {
        requestBody.tools = openAITools;
        requestBody.tool_choice = toolChoice;
    }

    const response = await fetch(
        SAMBANOVA_CHAT_URL,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },

            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const responseBody =
            await response.text();

        throw createProviderError({
            provider: "sambanova",
            model,
            response,
            responseBody
        });
    }

    const data = await response.json();

    const assistantMessage =
        data.choices?.[0]?.message ?? {};

    return {
        provider: "sambanova",

        model,

        content:
            assistantMessage.content ?? "",

        toolCalls:
            normalizeOpenAIToolCalls(
                assistantMessage
            ),

        usage: {
            inputTokens:
                data.usage?.prompt_tokens ?? null,

            outputTokens:
                data.usage?.completion_tokens ?? null,

            totalTokens:
                data.usage?.total_tokens ?? null
        },

        finishReason:
            data.choices?.[0]?.finish_reason ?? null,

        raw: data
    };
}