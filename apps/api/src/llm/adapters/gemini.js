const GEMINI_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateGemini({
    model,
    messages,
    temperature = 0.2,
    maxTokens = 8192
}) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "GEMINI_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";
        error.provider = "gemini";

        throw error;
    }

    const systemMessages = messages.filter(
        (message) => message.role === "system"
    );

    const conversationMessages = messages.filter(
        (message) => message.role !== "system"
    );

    const systemInstruction =
        systemMessages.length > 0
            ? {
                  parts: systemMessages.map((message) => ({
                      text: message.content
                  }))
              }
            : undefined;

    const contents = conversationMessages.map(
        (message) => ({
            role:
                message.role === "assistant"
                    ? "model"
                    : "user",
            parts: [
                {
                    text: message.content
                }
            ]
        })
    );

    const body = {
        contents,

        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens
        }
    };

    if (systemInstruction) {
        body.systemInstruction = systemInstruction;
    }

    const response = await fetch(
        `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        }
    );

    if (!response.ok) {
        const responseBody =
            await response.text();

        const error = new Error(
            `Gemini request failed with status ${response.status}: ${responseBody}`
        );

        error.provider = "gemini";
        error.model = model;
        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    const content =
        data.candidates?.[0]?.content?.parts
            ?.map((part) => part.text || "")
            .join("") || "";

    return {
        provider: "gemini",
        model,
        content,
        usage: {
            inputTokens:
                data.usageMetadata?.promptTokenCount ?? null,
            outputTokens:
                data.usageMetadata?.candidatesTokenCount ?? null,
            totalTokens:
                data.usageMetadata?.totalTokenCount ?? null
        },
        finishReason:
            data.candidates?.[0]?.finishReason ?? null,
        raw: data
    };
}