function normalizeText(value) {
    return typeof value === "string"
        ? value
        : "";
}

function countMatches(text, pattern) {
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
}

function detectTestEvidence(stdout, stderr) {
    const combined = `${stdout}\n${stderr}`;

    const testsPassed =
        countMatches(
            combined,
            /\bPASS(?:ED)?\b/gi
        );

    const testsFailed =
        countMatches(
            combined,
            /\bFAIL(?:ED|URE)?\b/gi
        );

    const assertionsFailed =
        countMatches(
            combined,
            /AssertionError/gi
        );

    const testFailurePatterns = [
        /expected.*(?:to be|to equal|to strictly equal)/i,
        /actual.*expected/i,
        /expected values to be strictly equal/i,
        /tests?\s+failed/i,
        /failed\s+tests?/i,
        /assertionerror/i,
        /\bFAIL:/i
    ];

    const hasTestFailureMessage =
        testFailurePatterns.some(
            (pattern) =>
                pattern.test(stdout) ||
                pattern.test(stderr)
        );

    const hasTestSuccessMessage =
        /\bPASS:/i.test(stdout) ||
        /\bPASS(?:ED)?\b/i.test(stdout) ||
        /\btests?\s+passed\b/i.test(stdout) ||
        /\ball\s+tests?\s+pass(?:ed)?\b/i.test(stdout);

    return {
        testsPassed,
        testsFailed,
        assertionsFailed,
        hasTestFailureMessage,
        hasTestSuccessMessage
    };
}

function detectCompilationFailure(stdout, stderr) {
    const combined = `${stdout}\n${stderr}`;

    const patterns = [
        /SyntaxError/i,
        /Compilation failed/i,
        /compile(?:r|ation)? error/i,
        /error:\s+/i,
        /cannot find symbol/i,
        /cannot find module/i,
        /module not found/i,
        /parse error/i
    ];

    return patterns.some((pattern) =>
        pattern.test(combined)
    );
}

function detectRuntimeFailure(stdout, stderr) {
    const combined = `${stdout}\n${stderr}`;

    const patterns = [
        /ReferenceError/i,
        /TypeError/i,
        /RangeError/i,
        /Error:/i,
        /Exception in thread/i,
        /Traceback \(most recent call last\)/i,
        /panic:/i,
        /segmentation fault/i,
        /uncaught exception/i
    ];

    return patterns.some((pattern) =>
        pattern.test(combined)
    );
}

function detectSandboxFailure(stdout, stderr) {
    const combined = `${stdout}\n${stderr}`;

    const patterns = [
        /SANDBOX_COMMAND_NOT_ALLOWED/i,
        /sandbox command.*not allowed/i,
        /invalid sandbox/i,
        /sandbox.*timeout/i,
        /permission denied/i,
        /operation not permitted/i
    ];

    return patterns.some((pattern) =>
        pattern.test(combined)
    );
}

export function classifyExecutionResult(result = {}) {
    const stdout = normalizeText(result.stdout);
    const stderr = normalizeText(result.stderr);

    const exitCode =
        typeof result.exitCode === "number"
            ? result.exitCode
            : null;

    const timedOut =
        result.timedOut === true ||
        result.timeOut === true;

    const testEvidence =
        detectTestEvidence(
            stdout,
            stderr
        );

    const sandboxFailure =
        detectSandboxFailure(
            stdout,
            stderr
        );

    const compilationFailure =
        detectCompilationFailure(
            stdout,
            stderr
        );

    const runtimeFailure =
        detectRuntimeFailure(
            stdout,
            stderr
        );

    /*
     * Timeout always takes priority.
     */
    if (timedOut) {
        return {
            ...result,
            success: false,
            status: "failed",
            failureType: "TIMEOUT",
            timedOut: true,
            evidence: testEvidence
        };
    }

    /*
     * Sandbox/policy failures must never be
     * treated as application bugs.
     */
    if (sandboxFailure) {
        return {
            ...result,
            success: false,
            status: "failed",
            failureType: "SANDBOX_FAILURE",
            timedOut: false,
            evidence: testEvidence
        };
    }

    /*
     * A test command can exit with code 0 while
     * printing FAIL messages. Detect that explicitly.
     */
    if (
        testEvidence.hasTestFailureMessage ||
        testEvidence.testsFailed > 0 ||
        testEvidence.assertionsFailed > 0
    ) {
        return {
            ...result,
            success: false,
            status: "failed",
            failureType: "TEST_FAILURE",
            timedOut: false,
            evidence: testEvidence
        };
    }

    /*
     * Non-zero process exit normally means the
     * executed program itself failed.
     */
    if (
        exitCode !== null &&
        exitCode !== 0
    ) {
        if (compilationFailure) {
            return {
                ...result,
                success: false,
                status: "failed",
                failureType: "COMPILATION_FAILURE",
                timedOut: false,
                evidence: testEvidence
            };
        }

        if (runtimeFailure) {
            return {
                ...result,
                success: false,
                status: "failed",
                failureType: "RUNTIME_FAILURE",
                timedOut: false,
                evidence: testEvidence
            };
        }

        return {
            ...result,
            success: false,
            status: "failed",
            failureType: "EXECUTION_FAILURE",
            timedOut: false,
            evidence: testEvidence
        };
    }

    /*
     * Explicit backend failure with no exit code.
     */
    if (result.success === false) {
        return {
            ...result,
            success: false,
            status: "failed",
            failureType: "EXECUTION_FAILURE",
            timedOut: false,
            evidence: testEvidence
        };
    }

    /*
     * Successful test output.
     */
    if (
        testEvidence.hasTestSuccessMessage &&
        testEvidence.testsFailed === 0
    ) {
        return {
            ...result,
            success: true,
            status: "passed",
            failureType: null,
            timedOut: false,
            evidence: testEvidence
        };
    }

    /*
     * Normal successful program execution.
     */
    return {
        ...result,
        success: true,
        status: "passed",
        failureType: null,
        timedOut: false,
        evidence: testEvidence
    };
}

export function isExecutionFailure(result) {
    return (
        classifyExecutionResult(result)
            .status === "failed"
    );
}

export function isTestFailure(result) {
    return (
        classifyExecutionResult(result)
            .failureType === "TEST_FAILURE"
    );
}

export function isSandboxFailure(result) {
    return (
        classifyExecutionResult(result)
            .failureType === "SANDBOX_FAILURE"
    );
}

export function isRuntimeFailure(result) {
    return (
        classifyExecutionResult(result)
            .failureType === "RUNTIME_FAILURE"
    );
}

export function isCompilationFailure(result) {
    return (
        classifyExecutionResult(result)
            .failureType === "COMPILATION_FAILURE"
    );
}

export function isSuccessfulExecution(result) {
    return (
        classifyExecutionResult(result)
            .status === "passed"
    );
}