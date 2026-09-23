import {createExecutionBackend} from "./executionBackend.js";

async function execute(){
    const error = new Error("Isolated sandbox backend is not configured yet");
    error.code = "ISOLATED_SANDBOX_NOT_CONFIGURED";
    throw error;
}

export const isolatedExecutionBackend = createExecutionBackend({
    name: "isolated",
    execute
});