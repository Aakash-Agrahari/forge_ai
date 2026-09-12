import { isModelHealthy } from "./modelHealth.js";

export function isModelEligible(model, requirements = {}) {
    if (!model) {
        return false;
    }

    // Model must be active unless explicitly disabled
    if (requirements.activeOnly !== false) {
        if (model.availability?.active !== true) {
            return false;
        }
    }

    // Deprecated models are excluded by default
    if (requirements.excludeDeprecated !== false) {
        if (model.availability?.deprecated === true) {
            return false;
        }
    }

    // Free-tier requirement
    if (requirements.freeOnly === true) {
        if (model.availability?.free !== true) {
            return false;
        }
    }

    // Temporarily unhealthy models are excluded
    if (
        requirements.skipUnhealthy !== false &&
        !isModelHealthy(model.provider, model.id)
    ) {
        return false;
    }

    return true;
}

export function filterEligibleModels(models, requirements = {}) {
    return models.filter((model) =>
        isModelEligible(model, requirements)
    );
}