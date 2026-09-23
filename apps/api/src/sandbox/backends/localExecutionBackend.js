import {exec} from "node:child_process";
import {promisify} from "node:util";

const execAsync = promisify(exec);

export async function executeLocalCommand({
    command, cwd, timeoutMs, maxOutputBytes
}) {
    const startedAt = Date.now();

    try{
        const result = await execAsync(command, {
            cwd,
            timeout: timeoutMs,
            maxBuffer: maxOutputBytes,
            windowsHide: true
        });

        return {
            success: true,
            exitCode: 0,
            stdout: result.stdout,
            stderr: result.stderr,
            durationMs: Date.now() - startedAt,
            timedOut: false
        };
    } catch (error){
        const timedOut = error?.killed === true || error?.signal === "SIGTERM";

        return {
            success: false,
            exitCode: typeof error?.code === "number" ? error.code : null,
            stdout: error?.stdout ?? "",
            stderr: error?.stderr ?? error?.message ?? "",
            durationMs: Date.now() - startedAt,
            timedOut
        };
    }
}