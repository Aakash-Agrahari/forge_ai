const CLOUDFLARE_BASE_URL =
    "https://api.cloudflare.com/client/v4/accounts";

export async function generateCloudflare({
    model,
    messages
}) {
    const token =
        process.env.CLOUDFLARE_API_TOKEN;

    const accountId =
        process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!token || !accountId) {
        const error = new Error(
            "Cloudflare API credentials are not configured"
        );

        error.code =
            "PROVIDER_NOT_CONFIGURED";

        error.provider =
            "cloudflare";

        throw error;
    }

    const response =
        await fetch(
            `${CLOUDFLARE_BASE_URL}/${accountId}/ai/run/${encodeURIComponent(model)}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${token}`
                },

                body: JSON.stringify({
                    messages
                })
            }
        );

    if (!response.ok) {
        const body =
            await response.text();

        const error = new Error(
            `Cloudflare request failed with status ${response.status}: ${body}`
        );

        error.provider =
            "cloudflare";

        error.model =
            model;

        error.statusCode =
            response.status;

        throw error;
    }

    const data =
        await response.json();

    return {
        provider: "cloudflare",
        model,

        content:
            data.result?.response ||
            data.result?.content ||
            "",

        usage: {
            inputTokens: null,
            outputTokens: null,
            totalTokens: null
        },

        finishReason: null,

        raw: data
    };
}