import { createTool } from "./toolContract.js";

import {
    upsertProjectFile,
    deleteProjectFile
} from "../../services/fileService.js";

import { executeProjectCommand } from "../../sandbox/sandboxService.js";
import { validateProjectPath } from "../projectPath.js";

function createTestFilePath(filePath) {
    const safeName = filePath
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 80);

    return `.forgeai-test-${safeName}-${Date.now()}.js`;
}

function createTestFileContent({
    filePath,
    functionName,
    args,
    expectedResult
}) {
    const serializedArgs = JSON.stringify(args);
    const serializedExpectedResult =
        JSON.stringify(expectedResult);

    return `import { pathToFileURL } from "node:url";
import path from "node:path";

const targetPath = path.resolve(${JSON.stringify(filePath)});

const moduleNamespace = await import(
    pathToFileURL(targetPath).href
);

const targetFunction =
    moduleNamespace[${JSON.stringify(functionName)}] ??
    moduleNamespace.default;

if (typeof targetFunction !== "function") {
    console.error(
        JSON.stringify({
            type: "TEST_ERROR",
            message: "Target function was not found",
            functionName: ${JSON.stringify(functionName)},
            availableExports: Object.keys(moduleNamespace)
        })
    );

    process.exit(1);
}

const args = ${serializedArgs};

const expectedResult = ${serializedExpectedResult};

let actualResult;

try {
    actualResult = await targetFunction(...args);
} catch (error) {
    console.error(
        JSON.stringify({
            type: "TEST_ERROR",
            message: error?.message || "Function execution failed",
            name: error?.name || "Error"
        })
    );

    process.exit(1);
}

const actualSerialized = JSON.stringify(actualResult);
const expectedSerialized = JSON.stringify(expectedResult);

if (actualSerialized !== expectedSerialized) {
    console.error(
        JSON.stringify({
            type: "TEST_FAILED",
            expected: expectedResult,
            actual: actualResult
        })
    );

    process.exit(1);
}

console.log(
    JSON.stringify({
        type: "TEST_PASSED",
        expected: expectedResult,
        actual: actualResult
    })
);
`;
}

export const runJavaScriptTestTool = createTool({
    name: "run_javascript_test",

    description:
        "Execute a JavaScript function with real input arguments in the ForgeAI sandbox and compare its actual return value with the expected result. Use this for behavioral verification after modifying JavaScript code.",

    inputSchema: {
        type: "object",

        properties: {
            filePath: {
                type: "string",
                description:
                    "Project-relative path to the JavaScript file containing the function."
            },

            functionName: {
                type: "string",
                description:
                    "Name of the JavaScript function to execute."
            },

            args: {
                type: "array",
                description:
                    "Arguments to pass to the function."
            },

            expectedResult: {
                description:
                    "Expected return value from the function."
            }
        },

        required: [
            "filePath",
            "functionName",
            "args",
            "expectedResult"
        ],

        additionalProperties: false
    },

    async execute(input, context) {
        if (!context?.projectId) {
            const error = new Error(
                "Project ID is required to run a JavaScript test"
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

        if (!Array.isArray(input.args)) {
            const error = new Error(
                "Test arguments must be an array"
            );

            error.code = "INVALID_TEST_ARGUMENTS";

            throw error;
        }

        const relativePath =
            validateProjectPath(input.filePath);

        if (!relativePath.endsWith(".js")) {
            const error = new Error(
                "run_javascript_test only supports .js files"
            );

            error.code = "UNSUPPORTED_FILE_TYPE";

            throw error;
        }

        const testFilePath =
            createTestFilePath(relativePath);

        const testContent =
            createTestFileContent({
                filePath: relativePath,
                functionName: input.functionName,
                args: input.args,
                expectedResult: input.expectedResult
            });

        let testFile = null;

        try {
            testFile = await upsertProjectFile({
                projectId: context.projectId,
                path: testFilePath,
                content: testContent
            });

            const result =
                await executeProjectCommand({
                    projectId: context.projectId,
                    command: `node ${testFilePath}`
                });

            let parsedOutput = null;

            const output =
                result.stdout?.trim() || "";

            if (output) {
                try {
                    parsedOutput =
                        JSON.parse(output);
                } catch {
                    parsedOutput = null;
                }
            }

            const passed =
                result.success &&
                result.exitCode === 0 &&
                !result.timeOut &&
                parsedOutput?.type === "TEST_PASSED";

            return {
                success: true,
                passed,
                filePath: relativePath,
                functionName: input.functionName,
                args: input.args,
                expectedResult: input.expectedResult,
                actualResult:
                    parsedOutput?.actual ?? null,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                durationMs: result.durationMs,
                timeOut: result.timeOut
            };
        } finally {
            if (testFile?.id) {
                try {
                    await deleteProjectFile({
                        projectId: context.projectId,
                        fileId: testFile.id
                    });
                } catch (cleanupError) {
                    console.error(
                        "[ForgeAI] Test file cleanup failed:",
                        cleanupError.message
                    );
                }
            }
        }
    }
});