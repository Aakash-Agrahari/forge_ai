import { createTool } from "./toolContract.js";
import { executeCode } from "../../execution/codeExecutionService.js";
import { validateProjectPath } from "../projectPath.js";

export const executeCodeTool = createTool({
    name: "execute_code",

    description:
        "Primary tool for running or verifying project code. Supports multiple programming languages through ForgeAI's language-aware execution system. Use this tool whenever the user asks to run, execute, build, or verify a source file. Do not use run_javascript_test unless the user explicitly requests a JavaScript function test with a function name, arguments, and expected return value.",
        
    inputSchema: {
        type: "object",

        properties: {
            filePath: {
                type: "string",
                description:
                    "Project-relative path of the source file to execute."
            }
        },

        required: [
            "filePath"
        ],

        additionalProperties: false
    },

    async execute(input, context) {
        if (!context?.projectId) {
            const error = new Error(
                "Project ID is required to execute code"
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

        const filePath =
            validateProjectPath(
                input.filePath
            );

        return executeCode({
            projectId:
                context.projectId,

            filePath
        });
    }
});