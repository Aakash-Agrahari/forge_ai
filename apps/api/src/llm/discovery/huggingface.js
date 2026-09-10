import {normalizeModel} from "../modelSchema.js";

const HF_MODELS_URL =
    "https://router.huggingface.co/v1/models";

export async function discoverHuggingFaceModels() {
    const apiKey =
        process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        return [];
    }

    const response = await fetch(
        HF_MODELS_URL,
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
            `Hugging Face model discovery failed with status ${response.status}: ${body}`
        );

        error.provider =
            "huggingface";

        error.statusCode =
            response.status;

        throw error;
    }

    const data =
        await response.json();

    return (data.data || [])
        .filter(
            (model) => model.id
        )
        .map(
            (model) =>
                normalizeModel({
                    id: model.id,
                    name:
                        model.id,
                    provider:
                        "huggingface",
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