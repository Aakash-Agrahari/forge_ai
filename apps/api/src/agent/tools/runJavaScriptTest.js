import { createTool } from "./toolContract.js";
import { executeProjectCommand } from "../../sandbox/sandboxService.js";
import { validateProjectPath } from "../projectPath.js";
import { prisma } from "../../db/prisma.js";

function createTemporaryTestFileName() {
    return `.forgeai-test-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.mjs`;
}

function normalizeValue(value) {
    return JSON.stringify(value);
}

export const runJavaScriptTestTool =
    createTool({
        name: "run_javascript_test",

        description:
            "Run a behavioral JavaScript test against a project function and return structured test execution results.",

        inputSchema: {
            type: "object",

            properties: {
                filePath: {
                    type: "string",
                    description:
                        "Project-relative path of the JavaScript file containing the function."
                },

                functionName: {
                    type: "string",
                    description:
                        "Name of the exported function to test."
                },

                arguments: {
                    type: "array",
                    description:
                        "Arguments passed to the function."
                },

                expectedResult: {
                    description:
                        "Expected return value."
                }
            },

            required: [
                "filePath",
                "functionName",
                "arguments",
                "expectedResult"
            ],

            additionalProperties: false
        },

        async execute(input, context) {
            if (!context?.projectId) {
                const error = new Error(
                    "Project ID is required to run JavaScript tests"
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

            if (
                typeof input?.functionName !== "string" ||
                !input.functionName.trim()
            ) {
                const error = new Error(
                    "Function name is required"
                );

                error.code =
                    "FUNCTION_NAME_REQUIRED";

                throw error;
            }

            if (!Array.isArray(input.arguments)) {
                const error = new Error(
                    "arguments must be an array"
                );

                error.code =
                    "INVALID_TEST_ARGUMENTS";

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
                    "run_javascript_test only supports JavaScript files"
                );

                error.code =
                    "UNSUPPORTED_FILE_TYPE";

                throw error;
            }

            const projectFile =
                await prisma.projectFile.findFirst({
                    where: {
                        projectId:
                            context.projectId,

                        path:
                            relativePath
                    }
                });

            if (!projectFile) {
                const error = new Error(
                    `Project file not found: ${relativePath}`
                );

                error.code =
                    "PROJECT_FILE_NOT_FOUND";

                throw error;
            }

            const testFilePath =
                createTemporaryTestFileName();

            const testFileContent = `
import * as moduleNamespace from ${JSON.stringify(
                `./${relativePath}`
            )};

const functionName =
    ${JSON.stringify(input.functionName)};

const args =
    ${JSON.stringify(input.arguments)};

const expected =
    ${JSON.stringify(input.expectedResult)};

const availableExports =
    Object.keys(moduleNamespace);

const targetFunction =
    moduleNamespace[functionName] ??
    moduleNamespace.default;

if (typeof targetFunction !== "function") {
    console.log(
        JSON.stringify({
            type: "TEST_SETUP_ERROR",
            success: false,
            reason: "Target function was not found",
            functionName,
            availableExports
        })
    );

    process.exit(2);
}

let actual;

try {
    actual =
        await targetFunction(...args);
} catch (error) {
    console.log(
        JSON.stringify({
            type: "TEST_FAILURE",
            success: false,
            reason: "Function threw an error",
            functionName,
            error: error?.message ?? String(error)
        })
    );

    process.exit(1);
}

const actualSerialized =
    JSON.stringify(actual);

const expectedSerialized =
    JSON.stringify(expected);

if (actualSerialized !== expectedSerialized) {
    console.log(
        JSON.stringify({
            type: "TEST_FAILURE",
            success: false,
            reason: "Returned value did not match expected value",
            functionName,
            actual,
            expected
        })
    );

    process.exit(1);
}

console.log(
    JSON.stringify({
        type: "TEST_PASS",
        success: true,
        functionName,
        actual,
        expected
    })
);
`;

            await prisma.projectFile.create({
                data: {
                    projectId:
                        context.projectId,

                    path:
                        testFilePath,

                    content:
                        testFileContent
                }
            });

            try {
                const result =
                    await executeProjectCommand({
                        projectId:
                            context.projectId,

                        command:
                            `node "${testFilePath}"`
                    });

                const output =
                    `${result.stdout ?? ""}\n${
                        result.stderr ?? ""
                    }`;

                let testEvidence = null;

                try {
                    const lines =
                        output
                            .split(/\r?\n/)
                            .map(
                                (line) =>
                                    line.trim()
                            )
                            .filter(Boolean);

                    for (
                        let i = lines.length - 1;
                        i >= 0;
                        i--
                    ) {
                        try {
                            const parsed =
                                JSON.parse(
                                    lines[i]
                                );

                            if (
                                parsed?.type ===
                                    "TEST_PASS" ||
                                parsed?.type ===
                                    "TEST_FAILURE" ||
                                parsed?.type ===
                                    "TEST_SETUP_ERROR"
                            ) {
                                testEvidence =
                                    parsed;

                                break;
                            }
                        } catch {
                            // Ignore non-JSON output.
                        }
                    }
                } catch {
                    testEvidence = null;
                }

                if (
                    testEvidence?.type ===
                    "TEST_SETUP_ERROR"
                ) {
                    return {
                        success: false,
                        status: "failed",
                        failureType:
                            "TEST_SETUP_FAILURE",
                        passed: false,
                        filePath:
                            relativePath,
                        functionName:
                            input.functionName,
                        actual: undefined,
                        expected:
                            input.expectedResult,
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
                        evidence:
                            testEvidence
                    };
                }

                if (
                    testEvidence?.type ===
                    "TEST_FAILURE"
                ) {
                    return {
                        success: false,
                        status: "failed",
                        failureType:
                            "TEST_FAILURE",
                        passed: false,
                        filePath:
                            relativePath,
                        functionName:
                            input.functionName,
                        actual:
                            testEvidence.actual,
                        expected:
                            testEvidence.expected ??
                            input.expectedResult,
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
                        evidence:
                            testEvidence
                    };
                }

                if (
                    testEvidence?.type ===
                    "TEST_PASS"
                ) {
                    return {
                        success: true,
                        status: "passed",
                        failureType: null,
                        passed: true,
                        filePath:
                            relativePath,
                        functionName:
                            input.functionName,
                        actual:
                            testEvidence.actual,
                        expected:
                            testEvidence.expected,
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
                        evidence:
                            testEvidence
                    };
                }

                return {
                    success:
                        result.success,

                    status:
                        result.status,

                    failureType:
                        result.failureType ??
                        "UNKNOWN_TEST_RESULT",

                    passed: false,

                    filePath:
                        relativePath,

                    functionName:
                        input.functionName,

                    expected:
                        input.expectedResult,

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

                    evidence:
                        result.evidence ?? null
                };
            } finally {
                await prisma.projectFile.deleteMany({
                    where: {
                        projectId:
                            context.projectId,

                        path:
                            testFilePath
                    }
                });
            }
        }
    });