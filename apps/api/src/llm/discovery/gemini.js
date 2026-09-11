import { normalizeModel } from "../modelSchema.js";

const GEMINI_MODELS_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

export async function discoverGeminiModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        const error = new Error("GEMINI_API_KEY is not configured");
        error.code = "PROVIDER_NOT_CONFIGURED";
        throw error;
    }

    const response = await fetch(
        `${GEMINI_MODELS_URL}?key=${encodeURIComponent(apiKey)}&pageSize=1000`
    );

    if (!response.ok) {
        const body = await response.text();

        const error = new Error(
            `Gemini model discovery failed with status ${response.status}: ${body}`
        );

        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    const models = Array.isArray(data.models)
        ? data.models
        : [];

    return models
        .filter((model) => {
            const methods = model.supportedGenerationMethods || [];

            return methods.includes("generateContent");
        })
        .map((model) => {
            const id = model.name?.replace(/^models\//, "");

            if (!id) {
                return null;
            }

            return normalizeModel({
                id,
                name: model.displayName || id,
                provider: "gemini",

                capabilities: {
                    toolCalling: false,
                    structuredOutput: false
                },

                modalities: {
                    input: ["text"],
                    output: ["text"]
                },

                tasks: [
                    "chat",
                    "code"
                ],

                contextWindow:
                    model.inputTokenLimit ??
                    null,

                free: true,

                active: true,

                deprecated: false
            });
        })
        .filter(Boolean);
}