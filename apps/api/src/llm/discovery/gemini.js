import { normalizeModel } from "../modelSchema.js";

const GEMINI_MODELS_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

function inferGeminiMetadata(model) {
    const id = String(
        model.name?.replace(/^models\//, "") || ""
    ).toLowerCase();

    // Text-to-speech
    if (
        id.includes("tts") ||
        id.includes("text-to-speech")
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

    // Speech-to-text / transcription
    if (
        id.includes("transcribe") ||
        id.includes("transcription")
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

    // Image generation / image models
    if (
        id.includes("image") ||
        id.includes("nano-banana")
    ) {
        return {
            tasks: [
                "image_generation",
                "image_understanding"
            ],
            modalities: {
                input: [
                    "text",
                    "image"
                ],
                output: [
                    "image",
                    "text"
                ]
            },
            capabilities: {
                toolCalling: false,
                structuredOutput: false
            }
        };
    }

    // Audio/music generation
    if (
        id.includes("lyria") ||
        id.includes("music")
    ) {
        return {
            tasks: ["audio_generation"],
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

    // Computer-use models
    if (
        id.includes("computer-use") ||
        id.includes("computer_use") ||
        id.includes("robotics")
    ) {
        return {
            tasks: [
                "computer_use",
                "chat"
            ],
            modalities: {
                input: [
                    "text",
                    "image"
                ],
                output: ["text"]
            },
            capabilities: {
                toolCalling: true,
                structuredOutput: true
            }
        };
    }

    // Deep research models
    if (
        id.includes("deep-research") ||
        id.includes("deep_research")
    ) {
        return {
            tasks: [
                "research",
                "chat"
            ],
            modalities: {
                input: ["text"],
                output: ["text"]
            },
            capabilities: {
                toolCalling: true,
                structuredOutput: true
            }
        };
    }

    // General-purpose language models
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
            structuredOutput: true
        }
    };
}

export async function discoverGeminiModels() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        const error = new Error(
            "GEMINI_API_KEY is not configured"
        );

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
            const methods =
                model.supportedGenerationMethods || [];

            return methods.includes(
                "generateContent"
            );
        })
        .map((model) => {
            const id =
                model.name?.replace(/^models\//, "");

            if (!id) {
                return null;
            }

            const metadata =
                inferGeminiMetadata(model);

            return normalizeModel({
                id,
                name: model.displayName || id,
                provider: "gemini",

                capabilities:
                    metadata.capabilities,

                modalities:
                    metadata.modalities,

                tasks:
                    metadata.tasks,

                contextWindow:
                    model.inputTokenLimit ?? null,

                availability: {
                    free: true,
                    active: true,
                    deprecated: false
                }
            });
        })
        .filter(Boolean);
}