export function createProviderError({
    provider,
    model,
    response,
    responseBody = ""
}) {
    const error = new Error(
        `${provider} request failed with status ${response.status}: ${responseBody}`
    );

    error.provider = provider;
    error.model = model;
    error.statusCode = response.status;

    const retryAfter = response.headers.get("retry-after");

    if(retryAfter){
        const retryAfterSeconds = Number(retryAfter);

        if(Number.isFinite(retryAfterSeconds)){
            error.retryAfterMs = retryAfterSeconds * 1000;
        }
    }

    const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");

    if(rateLimitRemaining != null){
        const value = Number(rateLimitRemaining);

        if(Number.isFinite(value)){
            error.rateLimitRemaining = value;
        }
    }

    const rateLimitReset = response.headers.get("x-ratelimit-reset");

    if(rateLimitReset !== null){
        error.rateLimitReset = rateLimitReset;
    }

    return error;
}