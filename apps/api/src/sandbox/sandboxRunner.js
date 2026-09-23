import {validateSandboxCommand,getSandboxLimits} from "./sandboxPolicy.js";
import { createSandboxResult } from "./sandboxResult.js";
import { executeLocalCommand } from "./backends/localExecutionBackend.js";

export async function runSandboxCommand({
    command,
    cwd,
    timeoutMs = 30_000,
    maxOutputBytes = 1_000_000
}) {
    const validatedCommand = validateSandboxCommand(command);

    const limits = getSandboxLimits({
        timeoutMs,
        maxOutputBytes
    });

    if (typeof cwd !== "string" || !cwd.trim()) {
        const error = new Error(
            "Sandbox working directory is required"
        );

        error.code = "INVALID_SANDBOX_CWD";

        throw error;
    }

    const result = await executeLocalCommand({
        command: validatedCommand,
        cwd,
        timeoutMs: limits.timeoutMs,
        maxOutputBytes: limits.maxOutputBytes
    });

    return createSandboxResult(result);
}