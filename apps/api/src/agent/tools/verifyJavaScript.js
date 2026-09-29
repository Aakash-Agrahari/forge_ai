import { createTool } from "./toolContract.js";
import { getProjectFile } from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";

export const verifyJavaScriptTool = createTool({
    name: "verify_javascript",

    description:
        "Verify that a JavaScript file contains a requested function and optionally verify its expected return expression without executing arbitrary code.",

    inputSchema: {
        type: "object",
        properties: {
            filePath: {
                type: "string",
                description:
                    "Project-relative path to the JavaScript file."
            },
            functionName: {
                type: "string",
                description:
                    "Name of the function that must exist."
            },
            expectedReturn: {
                type: "string",
                description:
                    "Optional expected return expression or value that should appear in the function."
            }
        },
        required: ["filePath", "functionName"],
        additionalProperties: false
    },

    async execute(input, context) {
        if (!context?.projectId) {
            const error = new Error(
                "Project ID is required to verify JavaScript"
            );

            error.code = "PROJECT_ID_REQUIRED";

            throw error;
        }

        if (!input?.filePath) {
            const error = new Error(
                "File path is required"
            );

            error.code = "FILE_PATH_REQUIRED";

            throw error;
        }

        if (!input?.functionName) {
            const error = new Error(
                "Function name is required"
            );

            error.code = "FUNCTION_NAME_REQUIRED";

            throw error;
        }

        const relativePath =
            validateProjectPath(input.filePath);

        if (!relativePath.endsWith(".js")) {
            const error = new Error(
                "verify_javascript only supports .js files"
            );

            error.code = "UNSUPPORTED_FILE_TYPE";

            throw error;
        }

        const file = await getProjectFile({
            projectId: context.projectId,
            fileId: null,
            path: relativePath
        });

        if (!file) {
            return {
                success: false,
                verified: false,
                filePath: relativePath,
                functionName: input.functionName,
                error: "File not found"
            };
        }

        const content = file.content ?? "";

        const escapedFunctionName =
            input.functionName.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        const functionPattern = new RegExp(
            `(?:function\\s+${escapedFunctionName}\\s*\\(|(?:const|let|var)\\s+${escapedFunctionName}\\s*=\\s*(?:async\\s*)?(?:function|\\([^)]*\\)\\s*=>|[^=]+=>))`,
            "m"
        );

        const functionFound =
            functionPattern.test(content);

        if (!functionFound) {
            return {
                success: true,
                verified: false,
                filePath: relativePath,
                functionName: input.functionName,
                reason: "Requested function was not found"
            };
        }

        let expectedReturnFound = true;

        if (input.expectedReturn) {
            expectedReturnFound =
                content.includes(input.expectedReturn);
        }

        return {
            success: true,
            verified:
                functionFound &&
                expectedReturnFound,
            filePath: relativePath,
            functionName: input.functionName,
            functionFound,
            expectedReturn:
                input.expectedReturn ?? null,
            expectedReturnFound,
            message:
                functionFound && expectedReturnFound
                    ? "JavaScript function verified successfully"
                    : "JavaScript verification failed"
        };
    }
});