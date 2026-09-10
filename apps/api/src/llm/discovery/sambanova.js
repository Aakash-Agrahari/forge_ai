import {normalizeModel} from "../modelSchema.js";

const SAMBANOVA_MODELS_URL =
    "https://api.sambanova.ai/v1/models";

export async function discoverSambaNovaModels() {
    const apiKey =
        process.env.SAMBANOVA_API_KEY;

    if (!apiKey) {
        return [];
    }

    const response = await fetch(
        SAMBANOVA_MODELS_URL,
        {
            headers: {
                Authorization:
                    `Bearer ${apiKey}`
            }
        }
    );

    if (!response.ok) {
        const body = await response.text();

        const error = new Error(
            `SambaNova model discovery failed with status ${response.status}: ${body}`
        );

        error.provider = "sambanova";
        error.statusCode =
            response.status;

        throw error;
    }

    const data = await response.json();

    return (data.data || [])
        .filter((model) => model.id)
        .map((model) =>
            normalizeModel({
                id: model.id,
                name: model.id,
                provider: "sambanova",
                capabilities: {
                    text: true,
                    code: true,
                    vision: false,
                    toolCalling: true,
                    structuredOutput: true
                },
                contextWindow:
                    model.context_length ??
                    null,
                free: true,
                active: true
            })
        );
}