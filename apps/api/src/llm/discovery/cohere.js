import { normalizeModel } from "../modelSchema.js";

const CURRENT_COHERE_MODELS = [
    "command-a-plus-05-2026"
];

export async function discoverCohereModels() {
    return CURRENT_COHERE_MODELS.map((id) =>
        normalizeModel({
            id,
            name: id,
            provider: "cohere",
            capabilities: {
                text: true,
                code: true,
                vision: false,
                toolCalling: true,
                structuredOutput: true
            },
            contextWindow: null,
            free: false,
            active: true,
            deprecated: false
        })
    );
}