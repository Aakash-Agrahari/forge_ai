import {normalizeModel} from "../modelSchema.js";

const NVIDIA_MODELS_URL =
    "https://integrate.api.nvidia.com/v1/models";

export async function discoverNvidiaModels() {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
        return [];
    }

    const response = await fetch(
        NVIDIA_MODELS_URL,
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
            `NVIDIA model discovery failed with status ${response.status}: ${body}`
        );

        error.provider = "nvidia";
        error.statusCode = response.status;

        throw error;
    }

    const data = await response.json();

    return (data.data || [])
        .filter((model) => model.id)
        .map((model) =>
            normalizeModel({
                id: model.id,
                name:
                    model.id,
                provider: "nvidia",
                capabilities: {
                    text: true,
                    code: true,
                    vision: false,
                    toolCalling: true,
                    structuredOutput: true
                },
                contextWindow:
                    model.context_length ??
                    null,
                free: true,
                active: true
            })
        );
}