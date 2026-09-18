export function classifyProviderError(error) {
    const statusCode = Number(error?.statusCode);
    const retryAfterMs = Number(error?.retryAfterMs) || null;

    const message = String(error?.message || "").toLowerCase();

    // Authentication / invalid API key
    if (statusCode === 401 || statusCode === 403) {
        return {
            type: "authentication",
            retryable: false,
            cooldownMs: 15 * 60 * 1000
        };
    }

    // Model does not exist / is no longer available
    if (statusCode === 404) {
        return {
            type: "model_unavailable",
            retryable: false,
            cooldownMs: 60 * 60 * 1000
        };
    }

    // Request format or capability is not supported
    if (
        message.includes("thought_signature") ||
        message.includes("thought signature") ||
        message.includes("tool call") &&
        (
            message.includes("not supported") ||
            message.includes("unsupported")
        ) ||
        message.includes("function calling is not supported") ||
        message.includes("tool calling is not supported") ||
        message.includes("multiturn chat not enabled")
    ) {
        return {
            type: "request_incompatible",
            retryable: false,
            cooldownMs: 60 * 60 * 1000
        };
    }

    // Request timeout
    if (statusCode === 408) {
        return {
            type: "timeout",
            retryable: true,
            cooldownMs: 30 * 1000
        };
    }

    // Rate limit / quota
    if (statusCode === 429) {
        return {
            type: "rate_limit",
            retryable: true,
            quotaLikelyExceeded: true,
            cooldownMs: retryAfterMs || 60 * 1000
        };
    }

    // Provider-side failure
    if (statusCode >= 500 && statusCode <= 599) {
        return {
            type: "provider_error",
            retryable: true,
            cooldownMs: 30 * 1000
        };
    }

    // Network timeout
    if (
        error?.name === "AbortError" ||
        error?.code === "ETIMEDOUT"
    ) {
        return {
            type: "timeout",
            retryable: true,
            cooldownMs: 30 * 1000
        };
    }

    // Provider configuration problem
    if (error?.code === "PROVIDER_NOT_CONFIGURED") {
        return {
            type: "configuration",
            retryable: false,
            cooldownMs: 60 * 60 * 1000
        };
    }

    return {
        type: "unknown",
        retryable: true,
        cooldownMs: 30 * 1000
    };
}