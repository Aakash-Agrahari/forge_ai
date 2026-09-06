import { normalizeModel } from "../modelSchema.js";

const OPENROUTER_MODELS_URL =
    "https://openrouter.ai/api/v1/models";

export async function discoverOpenRouterModels() {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        return [];
    }

    const response = await fetch(OPENROUTER_MODELS_URL, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        const body = await response.text();

        const error = new Error(
            `OpenRouter model discovery failed with status ${response.status}: ${body}`
        );

        error.provider = "openrouter";
        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    return (data.data || [])
        .filter((model) => {
            if (!model.id) {
                return false;
            }

            const promptPrice =
                Number(model.pricing?.prompt ?? Infinity);

            const completionPrice =
                Number(model.pricing?.completion ?? Infinity);

            return (
                promptPrice === 0 &&
                completionPrice === 0
            );
        })
        .map((model) =>
            normalizeModel({
                id: model.id,
                name: model.name || model.id,
                provider: "openrouter",

                capabilities: {
                    text: model.architecture?.input_modalities?.includes("text") ?? true,
                    code: true,
                    vision:
                        model.architecture?.input_modalities?.includes("image") ?? false,
                    toolCalling:
                        model.supported_parameters?.includes("tools") ?? false,
                    structuredOutput:
                        model.supported_parameters?.includes("response_format") ?? false
                },

                contextWindow:
                    model.context_length || null,

                free: true,
                active: true
            })
        );
}