import {
    getModelHealth
} from "./modelHealth.js";

export function scoreModel(
    model,
    requirements = {}
) {
    let score = 0;

    // Prefer models with larger context windows
    if (model.contextWindow) {
        score += Math.min(
            model.contextWindow / 100_000,
            10
        );
    }

    // Coding preference
    if (
        requirements.code &&
        model.capabilities.code
    ) {
        score += 30;
    }

    // Tool calling preference
    if (
        requirements.toolCalling &&
        model.capabilities.toolCalling
    ) {
        score += 20;
    }

    // Vision preference
    if (
        requirements.vision &&
        model.capabilities.vision
    ) {
        score += 15;
    }

    // Structured output preference
    if (
        requirements.structuredOutput &&
        model.capabilities.structuredOutput
    ) {
        score += 10;
    }

    // Free models get a preference
    if (model.availability.free) {
        score += 10;
    }

    const modelHealth =
        getModelHealth(
            model.provider,
            model.id
        );

    if (modelHealth.status === "healthy") {
        score += 20;
    }

    if (modelHealth.status === "unhealthy") {
        score -= 100;
    }

    return score;
}

export function rankModels(
    models,
    requirements = {}
) {
    return [...models]
        .map((model) => ({
            ...model,
            score: scoreModel(
                model,
                requirements
            )
        }))
        .sort(
            (a, b) => b.score - a.score
        );
}