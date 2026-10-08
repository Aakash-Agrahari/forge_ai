import {
    validateSandboxCommand,
    getSandboxLimits
} from "./sandboxPolicy.js";

import { createSandboxResult } from "./sandboxResult.js";
import { getExecutionBackend } from "./executionBackendFactory.js";
import {
    classifyExecutionResult
} from "../execution/executionResultClassifier.js";

const DEFAULT_BACKEND = "local";

export async function runSandboxCommand({
    command,
    cwd,
    timeoutMs = 30_000,
    maxOutputBytes = 1_000_000,
    backend = DEFAULT_BACKEND
}) {
    const validatedCommand =
        validateSandboxCommand(command);

    const limits =
        getSandboxLimits({
            timeoutMs,
            maxOutputBytes
        });

    if (
        typeof cwd !== "string" ||
        !cwd.trim()
    ) {
        const error = new Error(
            "Sandbox working directory is required"
        );

        error.code =
            "INVALID_SANDBOX_CWD";

        throw error;
    }

    const executionBackend =
        getExecutionBackend(backend);

    let result;

    try {
        result =
            await executionBackend.execute({
                command: validatedCommand,
                cwd,
                timeoutMs: limits.timeoutMs,
                maxOutputBytes:
                    limits.maxOutputBytes
            });
    } catch (error) {
        return {
            success: false,
            status: "failed",
            failureType: "SANDBOX_FAILURE",
            exitCode: null,
            stdout: "",
            stderr:
                error?.message ??
                "Sandbox execution failed",
            durationMs: 0,
            timeOut: false,
            error: {
                code:
                    error?.code ??
                    "SANDBOX_EXECUTION_ERROR",
                message:
                    error?.message ??
                    "Sandbox execution failed"
            }
        };
    }

    const sandboxResult =
        createSandboxResult(result);

    return classifyExecutionResult(
        sandboxResult
    );
}