import { createProviderError } from "../providerError.js";

const MISTRAL_CHAT_URL =
    "https://api.mistral.ai/v1/chat/completions";

export async function generateMistral({
    model,
    messages,
    temperature = 0.2,
    maxTokens = 8192
}) {
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "MISTRAL_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";
        error.provider = "mistral";

        throw error;
    }

    const response = await fetch(
        MISTRAL_CHAT_URL,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens
            })
        }
    );

    if (!response.ok) {
        const body = await response.text();

        throw createProviderError({
            provider: "mistral",
            model,
            response,
            responseBody: body
        });
    }

    const data = await response.json();

    return {
        provider: "mistral",
        model,
        content:
            data.choices?.[0]?.message?.content || "",
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