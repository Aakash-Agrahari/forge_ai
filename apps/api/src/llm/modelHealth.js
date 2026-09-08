const health = new Map();

export function getHealthKey(provider, model) {
    return `${provider}:${model}`;
}

export function getModelHealth(provider, model) {
    const key = getHealthKey(provider, model);

    return (
        health.get(key) || {
            status: "unknown",
            failures: 0,
            successes: 0,
            lastFailure: null,
            lastSuccess: null,
            cooldownUntil: null,
            lastErrorType: null
        }
    );
}

export function markModelSuccess(provider, model) {
    const key = getHealthKey(provider, model);

    health.set(key, {
        status: "healthy",
        failures: 0,
        successes:
            getModelHealth(provider, model).successes + 1,
        lastFailure:
            getModelHealth(provider, model).lastFailure,
        lastSuccess: new Date().toISOString(),
        cooldownUntil: null,
        lastErrorType: null
    });
}

export function markModelFailure(
    provider,
    model,
    {
        errorType = "unknown",
        cooldownMs = 60_000
    } = {}
) {
    const key = getHealthKey(provider, model);

    const current =
        getModelHealth(provider, model);

    health.set(key, {
        ...current,
        status: "unhealthy",
        failures: current.failures + 1,
        lastFailure: new Date().toISOString(),
        cooldownUntil:
            new Date(
                Date.now() + cooldownMs
            ).toISOString(),
        lastErrorType: errorType
    });
}

export function isModelHealthy(provider, model) {
    const modelHealth =
        getModelHealth(provider, model);

    if (modelHealth.status !== "unhealthy") {
        return true;
    }

    if (!modelHealth.cooldownUntil) {
        return false;
    }

    const cooldownExpired =
        Date.now() >=
        new Date(
            modelHealth.cooldownUntil
        ).getTime();

    return cooldownExpired;
}