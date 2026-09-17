import { createProviderError } from "../providerError.js";
import { normalizeOpenAIToolCalls } from "./openaiToolCalls.js";

const ZAI_CHAT_URL =
    "https://api.z.ai/api/paas/v4/chat/completions";

export async function generateZai({
    model,
    messages,
    temperature = 0.2,
    maxTokens = 8192
}) {
    const apiKey =
        process.env.ZAI_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "ZAI_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";
        error.provider = "zai";

        throw error;
    }

    const response = await fetch(
        ZAI_CHAT_URL,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization:
                    `Bearer ${apiKey}`,
                "Accept-Language":
                    "en-US,en"
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
            provider: "zai",
            model,
            response,
            responseBody: body
        });
    }

    const data = await response.json();

    return {
        provider: "zai",
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