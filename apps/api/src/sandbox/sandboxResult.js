export function createSandboxResult({
    success,
    exitCode = null,
    stdout = "",
    stderr = "",
    durationMs = 0,
    timeOut = false
}) {
    return {
        success: Boolean(success),
        exitCode,
        stdout,
        stderr,
        durationMs,
        timeOut: Boolean(timeOut)
    };
}