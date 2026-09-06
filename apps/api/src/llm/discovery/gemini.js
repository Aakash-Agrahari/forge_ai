import { normalizeModel } from "../modelSchema.js";

const GEMINI_MODELS_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

export async function discoverGeminiModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return [];
    }

    const response = await fetch(
        `${GEMINI_MODELS_URL}?key=${encodeURIComponent(apiKey)}`
    );

    if (!response.ok) {
        const body = await response.text();

        const error = new Error(
            `Gemini model discovery failed with status ${response.status}: ${body}`
        );

        error.provider = "gemini";
        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    return (data.models || [])
        .filter((model) => {
            if (!model.name) {
                return false;
            }

            const supportedMethods =
                model.supportedGenerationMethods || [];

            return supportedMethods.includes("generateContent");
        })
        .map((model) => {
            const modelId = model.name.replace(/^models\//, "");

            return normalizeModel({
                id: modelId,
                name: model.displayName || modelId,
                provider: "gemini",

                capabilities: {
                    text: true,
                    code: true,
                    vision: true,
                    toolCalling: true,
                    structuredOutput: true
                },

                contextWindow:
                    model.inputTokenLimit || null,

                free: true,
                active: true
            });
        });
}