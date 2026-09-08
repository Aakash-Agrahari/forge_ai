export function classifyProviderError(error) {
    const statusCode =
        Number(error?.statusCode);

    const retryAfterMs =
        Number(error?.retryAfterMs) || null;

    if (
        statusCode === 401 ||
        statusCode === 403
    ) {
        return {
            type: "authentication",
            retryable: false,
            cooldownMs:
                15 * 60 * 1000
        };
    }

    if (statusCode === 404) {
        return {
            type: "model_unavailable",
            retryable: false,
            cooldownMs:
                60 * 60 * 1000
        };
    }

    if (statusCode === 408) {
        return {
            type: "timeout",
            retryable: true,
            cooldownMs:
                30 * 1000
        };
    }

    if (statusCode === 429) {
        return {
            type: "rate_limit",
            retryable: true,
            cooldownMs:
                retryAfterMs ||
                60 * 1000
        };
    }

    if (
        statusCode >= 500 &&
        statusCode <= 599
    ) {
        return {
            type: "provider_error",
            retryable: true,
            cooldownMs:
                30 * 1000
        };
    }

    if (
        error?.name === "AbortError" ||
        error?.code === "ETIMEDOUT"
    ) {
        return {
            type: "timeout",
            retryable: true,
            cooldownMs:
                30 * 1000
        };
    }

    if (
        error?.code ===
        "PROVIDER_NOT_CONFIGURED"
    ) {
        return {
            type: "configuration",
            retryable: false,
            cooldownMs:
                60 * 60 * 1000
        };
    }

    return {
        type: "unknown",
        retryable: true,
        cooldownMs:
            30 * 1000
    };
}