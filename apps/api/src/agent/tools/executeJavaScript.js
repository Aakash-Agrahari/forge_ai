import { createTool } from "./toolContract.js";
import { executeProjectCommand } from "../../sandbox/sandboxService.js";
import { validateProjectPath } from "../projectPath.js";

export const executeJavaScriptTool =
    createTool({
        name: "execute_javascript",

        description:
            "Execute a JavaScript file from the current project in the ForgeAI sandbox and return structured execution results.",

        inputSchema: {
            type: "object",

            properties: {
                filePath: {
                    type: "string",
                    description:
                        "Project-relative path to the JavaScript file to execute."
                }
            },

            required: ["filePath"],

            additionalProperties: false
        },

        async execute(input, context) {
            if (!context?.projectId) {
                const error = new Error(
                    "Project ID is required to execute JavaScript"
                );

                error.code =
                    "PROJECT_ID_REQUIRED";

                throw error;
            }

            if (
                typeof input?.filePath !== "string" ||
                !input.filePath.trim()
            ) {
                const error = new Error(
                    "File path is required"
                );

                error.code =
                    "FILE_PATH_REQUIRED";

                throw error;
            }

            const relativePath =
                validateProjectPath(
                    input.filePath
                );

            if (
                !relativePath.endsWith(".js") &&
                !relativePath.endsWith(".mjs") &&
                !relativePath.endsWith(".cjs")
            ) {
                const error = new Error(
                    "execute_javascript only supports .js, .mjs and .cjs files"
                );

                error.code =
                    "UNSUPPORTED_FILE_TYPE";

                throw error;
            }

            const result =
                await executeProjectCommand({
                    projectId:
                        context.projectId,

                    command:
                        `node "${relativePath}"`
                });

            return {
                success:
                    result.success,

                status:
                    result.status,

                failureType:
                    result.failureType,

                filePath:
                    relativePath,

                exitCode:
                    result.exitCode,

                stdout:
                    result.stdout,

                stderr:
                    result.stderr,

                durationMs:
                    result.durationMs,

                timeOut:
                    result.timeOut,

                timedOut:
                    result.timedOut,

                evidence:
                    result.evidence ?? null
            };
        }
    });