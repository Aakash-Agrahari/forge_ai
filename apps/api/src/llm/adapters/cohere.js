const COHERE_CHAT_URL =
    "https://api.cohere.com/v2/chat";

export async function generateCohere({
    model,
    messages,
    temperature = 0.2,
    maxTokens = 8192
}) {
    const apiKey =
        process.env.COHERE_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "COHERE_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";
        error.provider = "cohere";

        throw error;
    }

    const response = await fetch(
        COHERE_CHAT_URL,
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

        const error = new Error(
            `Cohere request failed with status ${response.status}: ${body}`
        );

        error.provider = "cohere";
        error.model = model;
        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    const content =
        data.message?.content
            ?.filter(
                (item) =>
                    item.type === "text"
            )
            ?.map(
                (item) => item.text
            )
            ?.join("") || "";

    return {
        provider: "cohere",
        model,
        content,
        usage: {
            inputTokens:
                data.usage?.tokens
                    ?.input_tokens ?? null,
            outputTokens:
                data.usage?.tokens
                    ?.output_tokens ?? null,
            totalTokens:
                data.usage?.tokens
                    ?.total_tokens ?? null
        },
        finishReason:
            data.finish_reason ?? null,
        raw: data
    };
}