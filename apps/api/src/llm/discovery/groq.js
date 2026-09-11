import { normalizeModel } from "../modelSchema.js";

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

export async function discoverGroqModels() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        const error = new Error("GROQ_API_KEY is not configured");
        error.code = "PROVIDER_NOT_CONFIGURED";
        throw error;
    }

    const response = await fetch(GROQ_MODELS_URL, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        const body = await response.text();

        const error = new Error(
            `Groq model discovery failed with status ${response.status}: ${body}`
        );

        error.provider = "groq";
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
                provider: "groq",

                capabilities: {
                    toolCalling: true,
                    structuredOutput: true
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
                    model.context_window ?? null,

                free: true,

                active: true,

                deprecated: false
            })
        );
}