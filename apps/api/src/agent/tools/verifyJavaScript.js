import { createTool } from "./toolContract.js";
import { getProjectFiles } from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";

export const verifyJavaScriptTool = createTool({
    name: "verify_javascript",

    description:
        "Verify that a JavaScript file exists and contains a requested function. Optionally verify that the expected return expression is present.",

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
                    "Optional expected return expression or text that should appear in the function."
            }
        },

        required: [
            "filePath",
            "functionName"
        ],

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

        const files =
            await getProjectFiles(context.projectId);

        const file =
            files.find(
                (projectFile) =>
                    projectFile.path === relativePath
            );

        if (!file) {
            return {
                success: true,
                verified: false,
                filePath: relativePath,
                functionName: input.functionName,
                functionFound: false,
                expectedReturnFound: false,
                reason: "File not found"
            };
        }

        const content =
            file.content ?? "";

        const escapedFunctionName =
            input.functionName.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        /*
         * Supports common JavaScript function forms:
         *
         * function greet(name) {}
         *
         * const greet = function(name) {}
         *
         * const greet = (name) => {}
         *
         * const greet = name => {}
         */

        const functionPattern = new RegExp(
            [
                `function\\s+${escapedFunctionName}\\s*\\(`,
                `(?:const|let|var)\\s+${escapedFunctionName}\\s*=\\s*(?:async\\s+)?function\\s*\\(`,
                `(?:const|let|var)\\s+${escapedFunctionName}\\s*=\\s*(?:async\\s+)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>`
            ].join("|"),
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
                functionFound: false,
                expectedReturn:
                    input.expectedReturn ?? null,
                expectedReturnFound: false,
                reason:
                    "Requested function was not found in the file"
            };
        }

        let expectedReturnFound = true;

        if (input.expectedReturn) {
            expectedReturnFound =
                content.includes(input.expectedReturn);
        }

        const verified =
            functionFound &&
            expectedReturnFound;

        return {
            success: true,
            verified,
            filePath: relativePath,
            functionName: input.functionName,
            functionFound,
            expectedReturn:
                input.expectedReturn ?? null,
            expectedReturnFound,
            message: verified
                ? "JavaScript function verified successfully"
                : "JavaScript verification failed"
        };
    }
});