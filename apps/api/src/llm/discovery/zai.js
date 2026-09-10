import {normalizeModel} from "../modelSchema.js";

const CURRENT_ZAI_MODELS = [
    "glm-5.1",
    "glm-5-turbo",
    "glm-5",
    "glm-4.7",
    "glm-4.7-flash"
];

export async function discoverZaiModels() {
    if (!process.env.ZAI_API_KEY) {
        return [];
    }

    return CURRENT_ZAI_MODELS.map(
        (id) =>
            normalizeModel({
                id,
                name: id,
                provider: "zai",
                capabilities: {
                    text: true,
                    code: true,
                    vision:
                        id.includes("4.7") ||
                        id.includes("5"),
                    toolCalling: true,
                    structuredOutput: true
                },
                contextWindow: null,
                free: false,
                active: true
            })
    );
}