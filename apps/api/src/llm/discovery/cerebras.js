import { normalizeModel } from "../modelSchema.js";

const CEREBRAS_MODELS_URL =
    "https://api.cerebras.ai/v1/models";

export async function discoverCerebrasModels() {
    const apiKey = process.env.CEREBRAS_API_KEY;

    if (!apiKey) {
        return [];
    }

    const response = await fetch(CEREBRAS_MODELS_URL, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        const body = await response.text();

        const error = new Error(
            `Cerebras model discovery failed with status ${response.status}: ${body}`
        );

        error.provider = "cerebras";
        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    return (data.data || [])
        .filter((model) => model.id)
        .map((model) =>
            normalizeModel({
                id: model.id,
                name: model.id,
                provider: "cerebras",

                capabilities: {
                    text: true,
                    code: true,
                    vision: false,
                    toolCalling: true,
                    structuredOutput: true
                },

                contextWindow: null,

                free: true,
                active: true
            })
        );
}