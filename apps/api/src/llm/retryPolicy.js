const RETRYABLE_ERRORS = new Set([
    "timeout",
    "rate_limit",
    "provider_error",
    "unknown"
]);

export function shouldFallback(errorType){
    return true;
}

export function shouldRetrySameModel(errorType, attempt){
    if (attempt >= 1){
        return false;
    }
    return (
        errorType === "timeout"
    );
}

export function shouldTryNextModel(errorType){
    return RETRYABLE_ERRORS.has(errorType) ||
        errorType === "model_unavailable" || errorType === "authentication";
}