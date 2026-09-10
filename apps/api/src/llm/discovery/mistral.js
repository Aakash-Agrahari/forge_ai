import {normalizeModel} from "../modelSchema.js";

const MISTRAL_MODELS_URL =
    "https://api.mistral.ai/v1/models";

export async function discoverMistralModels() {
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
        return [];
    }

    const response = await fetch(
        MISTRAL_MODELS_URL,
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
            `Mistral model discovery failed with status ${response.status}: ${body}`
        );

        error.provider = "mistral";
        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    return (data.data || [])
        .filter(
            (model) =>
                model.id &&
                model.capabilities?.completion_chat &&
                !model.archived
        )
        .map((model) =>
            normalizeModel({
                id: model.id,
                name: model.id,
                provider: "mistral",
                capabilities: {
                    text: true,
                    code: true,
                    vision:
                        model.capabilities?.vision ??
                        false,
                    toolCalling:
                        model.capabilities
                            ?.function_calling ??
                        false,
                    structuredOutput: true
                },
                contextWindow:
                    model.max_context_length ??
                    null,
                free: false,
                active: true,
                deprecated: false
            })
        );
}