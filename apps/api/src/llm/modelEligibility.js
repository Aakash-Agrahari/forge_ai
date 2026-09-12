import { isModelHealthy } from "./modelHealth.js";

export function isModelEligible(model, requirements = {}) {
    if (!model) {
        return false;
    }

    // Availability checks
    if (requirements.activeOnly !== false) {
        if (!model.availability?.active) {
            return false;
        }
    }

    if (requirements.excludeDeprecated !== false) {
        if (model.availability?.deprecated) {
            return false;
        }
    }

    // Free-only requirement
    if (requirements.freeOnly === true) {
        if (model.availability?.free !== true) {
            return false;
        }
    }

    // Health check
    if (
        requirements.skipUnhealthy !== false &&
        !isModelHealthy(model.provider, model.id)
    ) {
        return false;
    }

    // Task requirements
    if (requirements.task) {
        const tasks = model.tasks || [];

        if (!tasks.includes(requirements.task)) {
            return false;
        }
    }

    // Multiple acceptable tasks
    if (requirements.tasks?.length) {
        const tasks = model.tasks || [];

        const hasRequiredTask = requirements.tasks.some((task) =>
            tasks.includes(task)
        );

        if (!hasRequiredTask) {
            return false;
        }
    }

    // Input modality
    if (requirements.inputModality) {
        const inputModalities = model.modalities?.input || [];

        if (!inputModalities.includes(requirements.inputModality)) {
            return false;
        }
    }

    // Output modality
    if (requirements.outputModality) {
        const outputModalities = model.modalities?.output || [];

        if (!outputModalities.includes(requirements.outputModality)) {
            return false;
        }
    }

    // Tool calling
    if (requirements.toolCalling === true) {
        if (model.capabilities?.toolCalling !== true) {
            return false;
        }
    }

    // Structured output
    if (requirements.structuredOutput === true) {
        if (model.capabilities?.structuredOutput !== true) {
            return false;
        }
    }

    // Context window
    if (requirements.minContextWindow) {
        if (
            !model.contextWindow ||
            model.contextWindow < requirements.minContextWindow
        ) {
            return false;
        }
    }

    return true;
}

export function filterEligibleModels(models, requirements = {}) {
    return models.filter((model) =>
        isModelEligible(model, requirements)
    );
}