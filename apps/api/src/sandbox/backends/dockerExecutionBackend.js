import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createExecutionBackend } from "./executionBackend.js";

const execFileAsync = promisify(execFile);

const DOCKER_IMAGE = process.env.FORGEAI_SANDBOX_IMAGE ?? "node:24-bookworm-slim";

function limitOutput(value, maxOutputBytes){
    if(typeof value !== "string"){
        return "";
    }

    const buffer = Buffer.from(value, "utf8");

    if(buffer.length <= maxOutputBytes){
        return value;
    }

    return buffer
        .subarray(0, maxOutputBytes)
        .toString("utf8");
}

async function execute({
    command, cwd, timeoutMs, maxOutputBytes
}) {
    const startedAt = Date.now();

    const dockerArguments = [
    "run",
    "--rm",

    "--network",
    "none",

    "--memory",
    "512m",

    "--cpus",
    "1",

    "--pids-limit",
    "128",

    "--read-only",

    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",

    "--tmpfs",
    "/workspace/node_modules:rw,nosuid,size=256m",

    "--workdir",
    "/workspace",

    "--volume",
    `${cwd}:/workspace:rw`,

    DOCKER_IMAGE,

    "sh",
    "-lc",
    command
];

    try {
        const result = await execFileAsync(
            "docker",
            dockerArguments,
            {
                timeout: timeoutMs,
                maxBuffer: maxOutputBytes,
                windowsHide: true
            }
        );

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
                error?.stderr ??
                    error?.message ??
                    "",
                maxOutputBytes
            ),
            durationMs: Date.now() - startedAt,
            timedOut
        };
    }
}

export const dockerExecutionBackend = createExecutionBackend({
    name: "docker",
    execute
});