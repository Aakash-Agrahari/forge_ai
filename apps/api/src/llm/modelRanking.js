import { getModelHealth } from "./modelHealth.js";

export function scoreModel(model, requirements = {}) {
    let score = 0;

    // Larger context window is generally better
    if (model.contextWindow) {
        score += Math.min(model.contextWindow / 100_000, 10);
    }

    // Task match
    if (requirements.task) {
        if ((model.tasks || []).includes(requirements.task)) {
            score += 40;
        }
    }

    // Tool calling
    if (requirements.toolCalling === true) {
        if (model.capabilities?.toolCalling === true) {
            score += 20;
        }
    }

    // Structured output
    if (requirements.structuredOutput === true) {
        if (model.capabilities?.structuredOutput === true) {
            score += 15;
        }
    }

    // Input modality
    if (requirements.inputModality) {
        if (
            (model.modalities?.input || []).includes(
                requirements.inputModality
            )
        ) {
            score += 15;
        }
    }

    // Output modality
    if (requirements.outputModality) {
        if (
            (model.modalities?.output || []).includes(
                requirements.outputModality
            )
        ) {
            score += 15;
        }
    }

    // Free models are preferred when requested
    if (requirements.freeOnly && model.availability?.free) {
        score += 10;
    }

    // Health
    const health = getModelHealth(
        model.provider,
        model.id
    );

    if (health.status === "healthy") {
        score += 20;
    }

    if (health.status === "unhealthy") {
        score -= 100;
    }

    return score;
}

export function rankModels(models, requirements = {}) {
    return [...models]
        .map((model) => ({
            ...model,
            score: scoreModel(model, requirements)
        }))
        .sort((a, b) => b.score - a.score);
}