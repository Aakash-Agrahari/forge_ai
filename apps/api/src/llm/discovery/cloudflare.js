import {normalizeModel} from "../modelSchema.js";

const CLOUDFLARE_MODELS_URL =
    "https://api.cloudflare.com/client/v4/accounts";

export async function discoverCloudflareModels() {
    const token =
        process.env.CLOUDFLARE_API_TOKEN;

    const accountId =
        process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!token || !accountId) {
        return [];
    }

    const response =
        await fetch(
            `${CLOUDFLARE_MODELS_URL}/${accountId}/ai/models/search?task=Text%20Generation`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

    if (!response.ok) {
        const body =
            await response.text();

        const error = new Error(
            `Cloudflare model discovery failed with status ${response.status}: ${body}`
        );

        error.provider =
            "cloudflare";

        error.statusCode =
            response.status;

        throw error;
    }

    const data =
        await response.json();

    const models =
        data.result || [];

    return models
        .filter(
            (model) =>
                model.name &&
                !model.deprecated
        )
        .map(
            (model) =>
                normalizeModel({
                    id:
                        model.name,

                    name:
                        model.name,

                    provider:
                        "cloudflare",

                    capabilities: {
                        text: true,
                        code: true,
                        vision:
                            model.properties
                                ?.vision ??
                            false,
                        toolCalling:
                            model.properties
                                ?.function_calling ??
                            false,
                        structuredOutput:
                            false
                    },

                    contextWindow:
                        model.properties
                            ?.context_length ??
                        null,

                    free: true,

                    active: true,

                    deprecated:
                        Boolean(
                            model.deprecated
                        )
                })
        );
}