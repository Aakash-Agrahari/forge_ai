import { createProviderError } from "../providerError.js";

const HF_CHAT_URL =
    "https://router.huggingface.co/v1/chat/completions";

export async function generateHuggingFace({
    model,
    messages,
    temperature = 0.2,
    maxTokens = 8192
}) {
    const apiKey =
        process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "HUGGINGFACE_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";
        error.provider = "huggingface";

        throw error;
    }

    const response = await fetch(
        HF_CHAT_URL,
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json",
                Authorization:
                    `Bearer ${apiKey}`
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
            provider: "huggingface",
            model,
            response,
            responseBody: body
        });
    }

    const data = await response.json();

    return {
        provider: "huggingface",
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