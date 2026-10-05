import { createSandboxSession } from "./sandboxSession.js";

export async function executeInSandboxSession({
    projectId,
    steps,
    timeoutMs = 30_000,
    maxOutputBytes = 1_000_000
}) {
    if (!projectId) {
        const error = new Error(
            "Project ID is required"
        );

        error.code = "PROJECT_ID_REQUIRED";

        throw error;
    }

    if (!Array.isArray(steps) || steps.length === 0) {
        const error = new Error(
            "At least one sandbox step is required"
        );

        error.code = "SANDBOX_STEPS_REQUIRED";

        throw error;
    }

    const session = await createSandboxSession({
        projectId
    });

    const results = [];

    try {
        for (const step of steps) {
            if (!step?.command) {
                const error = new Error(
                    "Every sandbox step requires a command"
                );

                error.code = "SANDBOX_COMMAND_REQUIRED";

                throw error;
            }

            const result = await session.run({
                command: step.command,
                timeoutMs: step.timeoutMs ?? timeoutMs,
                maxOutputBytes:
                    step.maxOutputBytes ?? maxOutputBytes
            });

            results.push({
                name: step.name ?? null,
                command: step.command,
                ...result
            });

            if (!result.success && step.stopOnFailure !== false) {
                break;
            }
        }

        return {
            success: results.every(
                (result) => result.success
            ),
            results
        };
    } finally {
        await session.close();
    }
}