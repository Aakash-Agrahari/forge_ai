import { localExecutionBackend } from "./backends/localExecutionBackend.js";
import {isolatedExecutionBackend} from "./backends/isolatedExecutionBackend.js";

const backends = new Map([
    [localExecutionBackend.name, localExecutionBackend],
    [isolatedExecutionBackend.name, isolatedExecutionBackend]
]);

export function getExecutionBackend(name = "local"){
    const backend = backends.get(name);

    if(!backend){
        const error = new Error(`UNknown sandbox execution backend: ${name}`);
        error.code = "UNKNOWN_SANDBOX_BACKEND";
        throw error;
    }
    return backend;
}

export function getAvailableExecutionBackends(){
    return [...backends.keys()];
}