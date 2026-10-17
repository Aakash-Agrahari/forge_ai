import { localExecutionBackend } from "./backends/localExecutionBackend.js";
import { isolatedExecutionBackend } from "./backends/isolatedExecutionBackend.js";
import { dockerExecutionBackend } from "./backends/dockerExecutionBackend.js";

const backends = new Map([
    [localExecutionBackend.name, localExecutionBackend],
    [isolatedExecutionBackend.name, isolatedExecutionBackend],
    [dockerExecutionBackend.name, dockerExecutionBackend]
]);

export function getExecutionBackend(name = "local") {
    console.log("[BACKEND FACTORY] Requested backend:", name);

    const backend = backends.get(name);

    if (!backend) {
        const error = new Error(
            `Unknown sandbox execution backend: ${name}`
        );

        error.code = "UNKNOWN_SANDBOX_BACKEND";

        throw error;
    }

    console.log(
        "[BACKEND FACTORY] Selected backend: ",
        backend.name
    );

    return backend;
}

export function getAvailableExecutionBackends() {
    return [...backends.keys()];
}