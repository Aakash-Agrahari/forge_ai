import { createTool } from "./toolContract.js";
import { executeProjectCommand } from "../../sandbox/sandboxService.js";

export const runCommandTool = createTool({
    name: "run_command",

    description:
        "Run an approved project command in the ForgeAI sandbox and return its output.",

    inputSchema: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description:
                    "The project command to execute, such as npm test."
            }
        },
        required: ["command"],
        additionalProperties: false
    },

    async execute(input, context) {
        if (!context?.projectId) {
            const error = new Error(
                "Project ID is required to run a command"
            );

            error.code = "PROJECT_ID_REQUIRED";

            throw error;
        }

        if (!input?.command) {
            const error = new Error(
                "Command is required"
            );

            error.code = "COMMAND_REQUIRED";

            throw error;
        }

        const result = await executeProjectCommand({
            projectId: context.projectId,
            command: input.command
        });

        return {
            success: result.success,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            durationMs: result.durationMs,
            timeOut: result.timeOut
        };
    }
});