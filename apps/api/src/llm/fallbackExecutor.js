import {executeProvider} from "./providerExecutor.js";
import {markModelSuccess,markModelFailure} from "./modelHealth.js";
import {classifyProviderError} from "./errorClassifier.js";

export async function executeWithFallback({
    models,
    messages,
    temperature,
    maxTokens
}) {
    if (
        !models ||
        models.length === 0
    ) {
        const error = new Error(
            "No eligible models available"
        );

        error.code =
            "NO_ELIGIBLE_MODELS";

        error.statusCode = 503;

        throw error;
    }

    const failures = [];

    for (const model of models) {
        try {
            const result =
                await executeProvider({
                    provider:
                        model.provider,

                    model:
                        model.id,

                    messages,

                    temperature,

                    maxTokens
                });

            markModelSuccess(
                model.provider,
                model.id
            );

            return {
                ...result,

                fallback: {
                    attempted:
                        failures.length + 1,

                    failedAttempts:
                        failures
                }
            };
        } catch (error) {
            const classification =
                classifyProviderError(
                    error
                );

            markModelFailure(
                model.provider,
                model.id,
                {
                    errorType:
                        classification.type,

                    cooldownMs:
                        classification.cooldownMs
                }
            );

            failures.push({
                provider:
                    model.provider,

                model:
                    model.id,

                errorType:
                    classification.type,

                statusCode:
                    error.statusCode ??
                    null,

                message:
                    error.message
            });

            continue;
        }
    }

    const error = new Error(
        "All available LLM models failed"
    );

    error.code =
        "ALL_MODELS_FAILED";

    error.statusCode = 503;

    error.failures = failures;

    throw error;
}