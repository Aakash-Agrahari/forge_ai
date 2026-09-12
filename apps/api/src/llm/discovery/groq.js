import { normalizeModel } from "../modelSchema.js";

const GROQ_MODELS_URL =
    "https://api.groq.com/openai/v1/models";

function inferGroqMetadata(model) {
    const id = String(model.id || "").toLowerCase();

    // Speech-to-text models
    if (
        id.includes("whisper") ||
        id.includes("speech-to-text") ||
        id.includes("stt")
    ) {
        return {
            tasks: ["speech_to_text"],
            modalities: {
                input: ["audio"],
                output: ["text"]
            },
            capabilities: {
                toolCalling: false,
                structuredOutput: false
            }
        };
    }

    // Text-to-speech models
    if (
        id.includes("tts") ||
        id.includes("orpheus")
    ) {
        return {
            tasks: ["text_to_speech"],
            modalities: {
                input: ["text"],
                output: ["audio"]
            },
            capabilities: {
                toolCalling: false,
                structuredOutput: false
            }
        };
    }

    // Prompt/content safety models
    if (
        id.includes("prompt-guard") ||
        id.includes("safeguard")
    ) {
        return {
            tasks: ["content_safety"],
            modalities: {
                input: ["text"],
                output: ["text"]
            },
            capabilities: {
                toolCalling: false,
                structuredOutput: false
            }
        };
    }

    // Compound models
    if (id.includes("compound")) {
        return {
            tasks: [
                "chat",
                "research",
                "code",
                "tool_use"
            ],
            modalities: {
                input: ["text"],
                output: ["text"]
            },
            capabilities: {
                toolCalling: false,
                structuredOutput: true
            }
        };
    }

    // General-purpose language model
    return {
        tasks: [
            "chat",
            "code"
        ],
        modalities: {
            input: ["text"],
            output: ["text"]
        },
        capabilities: {
            toolCalling: true,
            structuredOutput: false
        }
    };
}

export async function discoverGroqModels() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "GROQ_API_KEY is not configured"
        );

        error.code = "PROVIDER_NOT_CONFIGURED";

        throw error;
    }

    const response = await fetch(
        GROQ_MODELS_URL,
        {
            headers: {
                Authorization: `Bearer ${apiKey}`
            }
        }
    );

    if (!response.ok) {
        const body = await response.text();

        const error = new Error(
            `Groq model discovery failed with status ${response.status}: ${body}`
        );

        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    const models = Array.isArray(data.data)
        ? data.data
        : [];

    return models
        .map((model) => {
            if (!model?.id) {
                return null;
            }

            const metadata =
                inferGroqMetadata(model);

            return normalizeModel({
                id: model.id,
                name: model.id,
                provider: "groq",

                capabilities:
                    metadata.capabilities,

                modalities:
                    metadata.modalities,

                tasks:
                    metadata.tasks,

                contextWindow:
                    model.context_window ?? null,

                availability: {
                    free: true,
                    active: model.active !== false,
                    deprecated: false
                }
            });
        })
        .filter(Boolean);
}