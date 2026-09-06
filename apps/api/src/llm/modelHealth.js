const health = new Map(); //store the health status of each model provider

export function getHealthKey(provider, model){
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
            lastSuccess: null
        }
    );
}

export function markModelSuccess(provider, model) {
    const key = getHealthKey(provider, model);

    const current = getModelHealth(provider, model);

    health.set(key, {
        ...current,
        status: "healthy",
        successes: current.successes + 1,
        lastSuccess: new Date().toISOString()
    });
}

export function markModelFailure(
    provider,
    model
) {
    const key = getHealthKey(provider, model);

    const current = getModelHealth(provider, model);

    health.set(key, {
        ...current,
        status: "unhealthy",
        failures: current.failures + 1,
        lastFailure: new Date().toISOString()
    });
}

export function isModelHealthy(provider, model){
    const modelHealth = getModelHealth(provider, model);

    return modelHealth.status !== "unhealthy";
}