import { getModelHealth } from "./modelHealth.js";

export function scoreModel(model, requirements = {}) {
    let score = 0;

    // Task match is a preference, not an eligibility requirement.
    if (requirements.task) {
        const tasks = model.tasks || [];

        if (tasks.includes(requirements.task)) {
            score += 40;
        }
    }

    // Context window size is a preference, not an eligibility requirement.
    if (model.contextWindow) {
        score += Math.min(
            model.contextWindow / 100_000,
            10
        );
    }

    // Optional capability preferences.
    if (requirements.toolCalling === true) {
        if (model.capabilities?.toolCalling === true) {
            score += 20;
        }
    }

    if (requirements.structuredOutput === true) {
        if (model.capabilities?.structuredOutput === true) {
            score += 15;
        }
    }

    // Modality preferences.
    if (requirements.inputModality) {
        const input =
            model.modalities?.input || [];

        if (input.includes(requirements.inputModality)) {
            score += 15;
        }
    }

    if (requirements.outputModality) {
        const output =
            model.modalities?.output || [];

        if (output.includes(requirements.outputModality)) {
            score += 15;
        }
    }

    // Prefer free models when requested.
    if (
        requirements.freeOnly === true &&
        model.availability?.free === true
    ) {
        score += 10;
    }

    
    //Historical health.
    
    const health = getModelHealth(
        model.provider,
        model.id
    );

    if (health.status === "healthy") {
        score += 20;
    }

    return score;
}

export function rankModels(models, requirements = {}) {
    return [...models]
        .map((model) => ({
            ...model,
            score: scoreModel(
                model,
                requirements
            )
        }))
        .sort((a, b) => b.score - a.score);
}