import {exec} from "node:child_process";
import {promisify} from "node:util";
import {validateSandboxCommand, getSandboxLimits} from "./sandboxPolicy.js";
import {createSandboxResult} from "./sandboxResult.js";

const execAsync = promisify(exec);

export async function runSandboxCommand({
    command, cwd, timeoutMs=30_000, maxOutputBytes=1_000_000
}) {
    const validatedCommand = validateSandboxCommand(command);
    const limits = getSandboxLimits({
        timeoutMs,
        maxOutputBytes
    });

    if(typeof cwd !== "string" || !cwd.trim()){
        const error = new Error("Sandbox working directory is required");
        error.code = "INVALID_SANDBOX_CWD";
        throw error;
    }

    const startedAt = Date.now();

    try{
        const result = await execAsync(validatedCommand, {
            cwd,
            timeout: limits.timeoutMs,
            maxBuffer: limits.maxOutputBytes,
            windowsHide: true 
        });
        return createSandboxResult({
            success: true,
            exitCode: 0,
            stdout: result.stdout,
            stderr: result.stderr,
            durationMs: Date.now() - startedAt,
            timedOut: false
        });
    } catch (error){
        const timedOut = error?.killed === true || error?.signal === "SIGTERM";
        return createSandboxResult({
            success: false,
            exitCode: typeof error?.code === "number" ? error.code : null,
            stdout: error?.stdout ?? "",
            stderr: error?.stderr ?? error?.message ?? "",
            durationMs: Date.now() - startedAt,
            timedOut
        });
    }
}
