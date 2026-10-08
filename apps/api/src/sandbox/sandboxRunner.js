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

    const rawResult =
        await executionBackend.execute({
            command: validatedCommand,
            cwd,
            timeoutMs: limits.timeoutMs,
            maxOutputBytes: limits.maxOutputBytes
        });

    const sandboxResult =
        createSandboxResult(rawResult);

    const classifiedResult =
        classifyExecutionResult(
            sandboxResult
        );

    return {
        ...classifiedResult,

        command: validatedCommand,

        backend,

        classification: {
            status:
                classifiedResult.status,

            failureType:
                classifiedResult.failureType,

            evidence:
                classifiedResult.evidence
        }
    };
}