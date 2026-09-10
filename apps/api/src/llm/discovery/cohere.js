import {normalizeModel} from "../modelSchema.js";

const CURRENT_COHERE_MODELS = [
    "command-a-plus-05-2026"
];

export async function discoverCohereModels() {
    if (!process.env.COHERE_API_KEY) {
        return [];
    }

    return CURRENT_COHERE_MODELS.map(
        (id) =>
            normalizeModel({
                id,
                name: id,
                provider: "cohere",
                capabilities: {
                    text: true,
                    code: true,
                    vision: true,
                    toolCalling: true,
                    structuredOutput: true
                },
                contextWindow: null,
                free: false,
                active: true
            })
    );
}