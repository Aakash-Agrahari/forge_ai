import {
    exec as execCallback
} from "node:child_process";

import {
    promisify
} from "node:util";

import {
    createExecutionBackend
} from "./executionBackend.js";

const execAsync = promisify(execCallback);

function limitOutput(
    value,
    maxOutputBytes
) {
    const text =
        value === undefined ||
        value === null
            ? ""
            : String(value);

    if (
        Buffer.byteLength(
            text,
            "utf8"
        ) <= maxOutputBytes
    ) {
        return text;
    }

    return Buffer.from(
        text,
        "utf8"
    )
        .subarray(
            0,
            maxOutputBytes
        )
        .toString("utf8");
}

export const localExecutionBackend =
    createExecutionBackend({
        name: "local",

        async execute({
            command,
            cwd,
            timeoutMs = 30000,
            maxOutputBytes = 1000000
        }) {
            console.log(
                "\n[LOCAL BACKEND] ==============================="
            );

            console.log(
                "[LOCAL BACKEND] COMMAND:",
                command
            );

            console.log(
                "[LOCAL BACKEND] CWD:",
                cwd
            );

            console.log(
                "[LOCAL BACKEND] TIMEOUT:",
                timeoutMs
            );

            console.log(
                "[LOCAL BACKEND] MAX OUTPUT:",
                maxOutputBytes
            );

            try {
                const result =
                    await execAsync(
                        command,
                        {
                            cwd,
                            timeout:
                                timeoutMs,
                            maxBuffer:
                                maxOutputBytes,
                            windowsHide:
                                true
                        }
                    );

                const stdout =
                    limitOutput(
                        result.stdout,
                        maxOutputBytes
                    );

                const stderr =
                    limitOutput(
                        result.stderr,
                        maxOutputBytes
                    );

                console.log(
                    "[LOCAL BACKEND] EXIT CODE:",
                    0
                );

                console.log(
                    "[LOCAL BACKEND] STDOUT:",
                    JSON.stringify(
                        stdout
                    )
                );

                console.log(
                    "[LOCAL BACKEND] STDERR:",
                    JSON.stringify(
                        stderr
                    )
                );

                console.log(
                    "[LOCAL BACKEND] SUCCESS"
                );

                console.log(
                    "[LOCAL BACKEND] ===============================\n"
                );

                return {
                    success: true,
                    exitCode: 0,
                    stdout,
                    stderr
                };
            } catch (error) {
                const stdout =
                    limitOutput(
                        error?.stdout,
                        maxOutputBytes
                    );

                const stderr =
                    limitOutput(
                        error?.stderr,
                        maxOutputBytes
                    );

                const errorMessage =
                    error?.message ??
                    "Command execution failed";

                const combinedStderr =
                    stderr ||
                    errorMessage;

                const exitCode =
                    typeof error?.code ===
                        "number"
                        ? error.code
                        : null;

                console.error(
                    "\n[LOCAL BACKEND] ==============================="
                );

                console.error(
                    "[LOCAL BACKEND] COMMAND:",
                    command
                );

                console.error(
                    "[LOCAL BACKEND] CWD:",
                    cwd
                );

                console.error(
                    "[LOCAL BACKEND] ERROR:",
                    errorMessage
                );

                console.error(
                    "[LOCAL BACKEND] EXIT CODE:",
                    exitCode
                );

                console.error(
                    "[LOCAL BACKEND] STDOUT:",
                    JSON.stringify(
                        stdout
                    )
                );

                console.error(
                    "[LOCAL BACKEND] STDERR:",
                    JSON.stringify(
                        combinedStderr
                    )
                );

                console.error(
                    "[LOCAL BACKEND] ===============================\n"
                );

                return {
                    success: false,
                    exitCode,
                    stdout,
                    stderr:
                        combinedStderr
                };
            }
        }
    });