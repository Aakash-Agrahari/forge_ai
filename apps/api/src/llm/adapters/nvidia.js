const NVIDIA_CHAT_URL =
    "https://integrate.api.nvidia.com/v1/chat/completions";

export async function generateNvidia({
    model,
    messages,
    temperature = 0.2,
    maxTokens = 8192
}) {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "NVIDIA_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";
        error.provider = "nvidia";

        throw error;
    }

    const response = await fetch(
        NVIDIA_CHAT_URL,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
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

        const error = new Error(
            `NVIDIA request failed with status ${response.status}: ${body}`
        );

        error.provider = "nvidia";
        error.model = model;
        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    return {
        provider: "nvidia",
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