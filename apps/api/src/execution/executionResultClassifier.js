function normalizeOutput(value) {
    if (value === undefined || value === null) {
        return "";
    }

    return String(value).replace(/\r\n/g, "\n");
}

function detectTestEvidence(output) {
    const text = normalizeOutput(output);

    const passMatches =
        text.match(/\bPASS(?:ED)?\b/gi) ?? [];

    const failMatches =
        text.match(/\bFAIL(?:ED|URE)?\b/gi) ?? [];

    const assertionMatches =
        text.match(
            /\bAssertionError\b|\bexpected\b.*\bactual\b|\bactual\b.*\bexpected\b/gi
        ) ?? [];

    const testFailurePatterns = [
        /tests?\s+failed/i,
        /failed\s+tests?/i,
        /assertionerror/i,
        /expected[\s\S]{0,100}(?:to be|to equal|to strictly equal|but)/i,
        /actual[\s\S]{0,100}expected/i,
        /\bFAIL\s*:/i,
        /\bFAILED\s*:/i
    ];

    const explicitFailure =
        testFailurePatterns.some(
            (pattern) => pattern.test(text)
        );

    return {
        passCount: passMatches.length,
        failCount: failMatches.length,
        assertionCount: assertionMatches.length,
        hasFailure:
            failMatches.length > 0 ||
            assertionMatches.length > 0 ||
            explicitFailure,
        hasPass:
            passMatches.length > 0,
        output: text
    };
}

function detectCompilationFailure(output) {
    const text = normalizeOutput(output);

    const patterns = [
        /\bSyntaxError\b/i,
        /\bCompilation failed\b/i,
        /\bCompilation error\b/i,
        /\bcompile error\b/i,
        /\bcompile failed\b/i,
        /\bcannot find symbol\b/i,
        /\bmodule not found\b/i,
        /\bcannot find module\b/i,
        /\bparse error\b/i,
        /\berror:\s+cannot find\b/i,
        /\berror:\s+expected\b/i
    ];

    return patterns.some(
        (pattern) => pattern.test(text)
    );
}

function detectRuntimeFailure(output) {
    const text = normalizeOutput(output);

    const patterns = [
        /\bReferenceError\b/i,
        /\bTypeError\b/i,
        /\bRangeError\b/i,
        /\bException in thread\b/i,
        /\bTraceback\b/i,
        /\bpanic:/i,
        /\bsegmentation fault\b/i,
        /\buncaught exception\b/i
    ];

    return patterns.some(
        (pattern) => pattern.test(text)
    );
}

function detectSandboxFailure(output) {
    const text = normalizeOutput(output);

    const patterns = [
        /SANDBOX_COMMAND_NOT_ALLOWED/i,
        /sandbox command not allowed/i,
        /invalid sandbox/i,
        /sandbox timeout/i,
        /permission denied/i,
        /operation not permitted/i
    ];

    return patterns.some(
        (pattern) => pattern.test(text)
    );
}

export function classifyExecutionResult(result = {}) {
    const stdout =
        normalizeOutput(result.stdout);

    const stderr =
        normalizeOutput(result.stderr);

    const combinedOutput =
        `${stdout}\n${stderr}`.trim();

    const testEvidence =
        detectTestEvidence(combinedOutput);

    const compilationFailure =
        detectCompilationFailure(
            combinedOutput
        );

    const runtimeFailure =
        detectRuntimeFailure(
            combinedOutput
        );

    const sandboxFailure =
        detectSandboxFailure(
            combinedOutput
        );

    const timedOut =
        result.timedOut === true ||
        result.timeOut === true;

    /*
     * ------------------------------------------
     * TIMEOUT
     * ------------------------------------------
     */

    if (timedOut) {
        return {
            ...result,
            success: false,
            status: "failed",
            failureType: "TIMEOUT",
            evidence: {
                stdout,
                stderr,
                reason: "Execution timed out"
            }
        };
    }

    /*
     * ------------------------------------------
     * SANDBOX FAILURE
     * ------------------------------------------
     */

    if (sandboxFailure) {
        return {
            ...result,
            success: false,
            status: "failed",
            failureType: "SANDBOX_FAILURE",
            evidence: {
                stdout,
                stderr,
                reason:
                    "Sandbox policy or sandbox execution failure"
            }
        };
    }

    /*
     * ------------------------------------------
     * TEST FAILURE
     *
     * Important:
     * A test script may catch assertion errors
     * and still exit with code 0.
     *
     * Therefore exitCode === 0 does NOT
     * automatically mean the test passed.
     * ------------------------------------------
     */

    if (testEvidence.hasFailure) {
        return {
            ...result,
            success: false,
            status: "failed",
            failureType: "TEST_FAILURE",
            evidence: {
                stdout,
                stderr,
                passCount:
                    testEvidence.passCount,
                failCount:
                    testEvidence.failCount,
                assertionCount:
                    testEvidence.assertionCount,
                reason:
                    "Test failure evidence detected in execution output"
            }
        };
    }

    /*
     * ------------------------------------------
     * NON-ZERO EXIT CODE
     * ------------------------------------------
     */

    if (
        result.exitCode !== undefined &&
        result.exitCode !== null &&
        result.exitCode !== 0
    ) {
        let failureType =
            "EXECUTION_FAILURE";

        if (compilationFailure) {
            failureType =
                "COMPILATION_FAILURE";
        } else if (runtimeFailure) {
            failureType =
                "RUNTIME_FAILURE";
        }

        return {
            ...result,
            success: false,
            status: "failed",
            failureType,
            evidence: {
                stdout,
                stderr,
                reason:
                    "Process exited with a non-zero exit code"
            }
        };
    }

    /*
     * ------------------------------------------
     * EXPLICIT SUCCESS
     * ------------------------------------------
     */

    if (
        result.success === true &&
        (
            result.exitCode === undefined ||
            result.exitCode === null ||
            result.exitCode === 0
        )
    ) {
        return {
            ...result,
            success: true,
            status: "passed",
            failureType: null,
            evidence: {
                stdout,
                stderr,
                passCount:
                    testEvidence.passCount,
                failCount:
                    testEvidence.failCount,
                assertionCount:
                    testEvidence.assertionCount,
                reason:
                    "Execution completed successfully without failure evidence"
            }
        };
    }

    /*
     * ------------------------------------------
     * FALLBACK
     * ------------------------------------------
     */

    return {
        ...result,
        success: false,
        status: "failed",
        failureType: "UNKNOWN_EXECUTION_RESULT",
        evidence: {
            stdout,
            stderr,
            reason:
                "Execution result could not be proven successful"
        }
    };
}

export function isExecutionFailure(result) {
    return (
        result?.status === "failed" ||
        result?.success === false
    );
}

export function isTestFailure(result) {
    return (
        result?.failureType ===
        "TEST_FAILURE"
    );
}

export function isSandboxFailure(result) {
    return (
        result?.failureType ===
        "SANDBOX_FAILURE"
    );
}

export function isRuntimeFailure(result) {
    return (
        result?.failureType ===
        "RUNTIME_FAILURE"
    );
}

export function isCompilationFailure(result) {
    return (
        result?.failureType ===
        "COMPILATION_FAILURE"
    );
}

export function isSuccessfulExecution(result) {
    return (
        result?.success === true &&
        result?.status === "passed"
    );
}