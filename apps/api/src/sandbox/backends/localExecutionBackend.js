import { exec } from "node:child_process";
import { promisify } from "node:util";

import { createExecutionBackend } from "./executionBackend.js";

const execAsync = promisify(exec);

function limitOutput(value, maxOutputBytes) {
    if (typeof value !== "string") {
        return "";
    }

    const buffer = Buffer.from(value, "utf8");

    if (buffer.length <= maxOutputBytes) {
        return value;
    }

    return buffer
        .subarray(0, maxOutputBytes)
        .toString("utf8");
}

async function execute({
    command,
    cwd,
    timeoutMs,
    maxOutputBytes
}) {
    const startedAt = Date.now();

    try {
        const result = await execAsync(command, {
            cwd,
            timeout: timeoutMs,
            maxBuffer: maxOutputBytes,
            windowsHide: true
        });

        return {
            success: true,
            exitCode: 0,
            stdout: limitOutput(
                result.stdout,
                maxOutputBytes
            ),
            stderr: limitOutput(
                result.stderr,
                maxOutputBytes
            ),
            durationMs: Date.now() - startedAt,
            timedOut: false
        };
    } catch (error) {
        const timedOut =
            error?.killed === true ||
            error?.signal === "SIGTERM";

        return {
            success: false,
            exitCode:
                typeof error?.code === "number"
                    ? error.code
                    : null,
            stdout: limitOutput(
                error?.stdout ?? "",
                maxOutputBytes
            ),
            stderr: limitOutput(
                error?.stderr ?? error?.message ?? "",
                maxOutputBytes
            ),
            durationMs: Date.now() - startedAt,
            timedOut
        };
    }
}

export const localExecutionBackend =
    createExecutionBackend({
        name: "local",
        execute
    });