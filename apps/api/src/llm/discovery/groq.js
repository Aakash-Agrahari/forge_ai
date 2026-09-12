import { normalizeModel } from "../modelSchema.js";

const GROQ_MODELS_URL =
    "https://api.groq.com/openai/v1/models";

function classifyGroqModel(model) {
    const id = model.id;

    // Speech-to-text
    if (
        id === "whisper-large-v3" ||
        id === "whisper-large-v3-turbo"
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

    // Text-to-speech
    if (
        id === "canopylabs/orpheus-v1-english" ||
        id === "canopylabs/orpheus-arabic-saudi"
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

    // Prompt Guard
    if (
        id === "meta-llama/llama-prompt-guard-2-22m" ||
        id === "meta-llama/llama-prompt-guard-2-86m"
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

    // Safety model
    if (id === "openai/gpt-oss-safeguard-20b") {
        return {
            tasks: [
                "chat",
                "content_safety",
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

    // Compound systems
    if (
        id === "groq/compound" ||
        id === "groq/compound-mini"
    ) {
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
        .filter((model) => model.active !== false)
        .map((model) => {
            const classification =
                classifyGroqModel(model);

            return normalizeModel({
                id: model.id,
                name: model.id,
                provider: "groq",

                capabilities:
                    classification.capabilities,

                modalities:
                    classification.modalities,

                tasks:
                    classification.tasks,

                contextWindow:
                    model.context_window ?? null,

                availability: {
                    free: true,
                    active: model.active !== false,
                    deprecated: false
                }
            });
        });
}