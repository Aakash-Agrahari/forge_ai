const CEREBRAS_CHAT_URL =
    "https://api.cerebras.ai/v1/chat/completions";

export async function generateCerebras({
    model,
    messages,
    temperature = 0.2,
    maxTokens = 8192
}) {
    const apiKey =
        process.env.CEREBRAS_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "CEREBRAS_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";
        error.provider = "cerebras";

        throw error;
    }

    const response = await fetch(
        CEREBRAS_CHAT_URL,
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
        const responseBody =
            await response.text();

        const error = new Error(
            `Cerebras request failed with status ${response.status}: ${responseBody}`
        );

        error.provider = "cerebras";
        error.model = model;
        error.statusCode = response.status;

        const retryAfter = response.headers.get("retry-after");
        if(retryAfter){
            const retryAfterSeconds = Number(retryAfter);
            if(Number.isFinite(retryAfterSeconds)){
                error.retryAfterMs = retryAfterSeconds * 1000;
            }
        }

        throw error;
    }

    const data = await response.json();

    return {
        provider: "cerebras",
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