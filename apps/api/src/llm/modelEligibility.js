export function isModelEligible(
    model,
    requirements = {}
) {
    if (!model) {
        return false;
    }

    if (!model.availability.active) {
        return false;
    }

    if (model.availability.deprecated) {
        return false;
    }

    if (
        requirements.freeOnly === true &&
        !model.availability.free
    ) {
        return false;
    }

    if (
        requirements.code === true &&
        !model.capabilities.code
    ) {
        return false;
    }

    if (
        requirements.vision === true &&
        !model.capabilities.vision
    ) {
        return false;
    }

    if (
        requirements.toolCalling === true &&
        !model.capabilities.toolCalling
    ) {
        return false;
    }

    if (
        requirements.structuredOutput === true &&
        !model.capabilities.structuredOutput
    ) {
        return false;
    }

    if (
        requirements.contextWindow &&
        (
            !model.contextWindow ||
            model.contextWindow < requirements.contextWindow
        )
    ) {
        return false;
    }

    return true;
}

export function filterEligibleModels(
    models,
    requirements = {}
) {
    return models.filter((model) =>
        isModelEligible(model, requirements)
    );
}