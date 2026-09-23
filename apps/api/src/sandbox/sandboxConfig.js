const DEFAULT_BACKEND = "local";

const SUPPORTED_BACKENDS = new Set([
    "local",
    "isolated"
]);

export function getSandboxConfig() {
    const backend = process.env.FORGEAI_SANDBOX_BACKEND ?? DEFAULT_BACKEND;

    if(!SUPPORTED_BACKENDS.has(backend)){
        const error = new Error(`Unsupported sandbox backend: ${backend}`);
        error.code = "UNSUPPORTED_SANDBOX_BACKEND";
        throw error;
    }

    return {
        backend
    };
}