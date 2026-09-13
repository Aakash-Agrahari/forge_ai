const quota = new Map();

function createDefaultQuota() {
    return {
        status: "available",
        requestsUsed: 0,
        requestsRemaining: null,
        resetAt: null,
        lastUpdated: null,
        lastErrorType: null
    };
}

function getQuotaKey(provider, model) {
    return `${provider}:${model}`;
}

export function getModelQuota(provider, model) {
    const key = getQuotaKey(provider, model);

    return quota.get(key) || createDefaultQuota();
}

export function markModelRequest(provider, model) {
    const key = getQuotaKey(provider, model);

    const current = getModelQuota(provider, model);

    quota.set(key, {
        ...current,
        requestsUsed: current.requestsUsed + 1,
        lastUpdated: new Date().toISOString()
    });
}

export function markModelQuotaExceeded(
    provider,
    model,
    {
        resetAt = null,
        errorType = "rate_limit"
    } = {}
) {
    const key = getQuotaKey(provider, model);

    const current = getModelQuota(provider, model);

    quota.set(key, {
        ...current,
        status: "exhausted",
        resetAt,
        lastUpdated: new Date().toISOString(),
        lastErrorType: errorType
    });
}

export function markModelQuotaAvailable(provider, model) {
    const key = getQuotaKey(provider, model);

    const current = getModelQuota(provider, model);

    quota.set(key, {
        ...current,
        status: "available",
        resetAt: null,
        lastUpdated: new Date().toISOString(),
        lastErrorType: null
    });
}

export function isModelQuotaAvailable(provider, model) {
    const modelQuota = getModelQuota(provider, model);

    if (modelQuota.status !== "exhausted") {
        return true;
    }

    if (!modelQuota.resetAt) {
        return false;
    }

    const resetTime =
        new Date(modelQuota.resetAt).getTime();

    if (Date.now() >= resetTime) {
        markModelQuotaAvailable(provider, model);
        return true;
    }

    return false;
}

export function getAllModelQuota() {
    const result = [];

    for (const [key, value] of quota.entries()) {
        const separatorIndex = key.indexOf(":");

        const provider =
            key.slice(0, separatorIndex);

        const model =
            key.slice(separatorIndex + 1);

        result.push({
            provider,
            model,
            ...value
        });
    }

    return result;
}

export function clearModelQuota() {
    quota.clear();
}