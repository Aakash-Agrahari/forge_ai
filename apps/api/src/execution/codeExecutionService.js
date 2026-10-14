import path from "node:path";

import { getProjectFiles } from "../services/fileService.js";
import { validateProjectPath } from "../agent/projectPath.js";
import { executeInSandboxSession } from "../sandbox/sandboxSessionService.js";

import {
    detectPrimaryProjectLanguage,
    detectLanguageFromFile
} from "./languageDetector.js";

import {
    getExecutionStrategy,
    createRunCommand,
    getSupportedExecutionLanguages
} from "./executionStrategy.js";


function createUnsupportedLanguageError(
    language
) {
    const error = new Error(
        `Unsupported execution language: ${language}`
    );

    error.code =
        "UNSUPPORTED_EXECUTION_LANGUAGE";

    error.statusCode = 400;

    return error;
}


function createFileNotFoundError(
    filePath
) {
    const error = new Error(
        `Project file not found: ${filePath}`
    );

    error.code =
        "EXECUTION_FILE_NOT_FOUND";

    error.statusCode = 404;

    return error;
}


function getProjectFileByPath(
    files,
    filePath
) {
    const normalizedPath =
        validateProjectPath(filePath);

    return files.find(
        (file) =>
            validateProjectPath(
                file.path
            ) === normalizedPath
    );
}


function getJavaClassName(
    filePath
) {
    const normalizedPath =
        validateProjectPath(filePath);

    const fileName =
        path.posix.basename(
            normalizedPath
        );

    if (!fileName.endsWith(".java")) {
        const error = new Error(
            "Java execution requires a .java file"
        );

        error.code =
            "INVALID_JAVA_FILE";

        throw error;
    }

    return fileName.slice(
        0,
        -".java".length
    );
}


function getJavaPackageName(
    content
) {
    if (typeof content !== "string") {
        return null;
    }

    const match =
        content.match(
            /^\s*package\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/m
        );

    return match?.[1] ?? null;
}


function getJavaSourceFiles(
    files
) {
    return files
        .filter(
            (file) =>
                typeof file.path === "string" &&
                file.path
                    .toLowerCase()
                    .endsWith(".java")
        )
        .map(
            (file) =>
                validateProjectPath(
                    file.path
                )
        );
}


function getJavaCompileCommand(
    javaFiles
) {
    if (javaFiles.length === 0) {
        const error = new Error(
            "No Java source files found in project"
        );

        error.code =
            "NO_JAVA_SOURCE_FILES";

        throw error;
    }

    const sourceArguments =
        javaFiles
            .map(
                (filePath) =>
                    `"${filePath}"`
            )
            .join(" ");

    return `javac ${sourceArguments}`;
}


function getJavaRunCommand({
    filePath,
    content
}) {
    const className =
        getJavaClassName(
            filePath
        );

    const packageName =
        getJavaPackageName(
            content
        );

    const mainClass =
        packageName
            ? `${packageName}.${className}`
            : className;

    return `java ${mainClass}`;
}


function createExecutionCommand({
    language,
    filePath,
    files,
    fileContent
}) {
    /*
     * Java requires special handling because
     * the project may contain multiple source
     * files and package declarations.
     */
    if (language === "java") {
        const javaFiles =
            getJavaSourceFiles(files);

        return {
            command:
                getJavaRunCommand({
                    filePath,
                    content:
                        fileContent
                }),

            buildCommand:
                getJavaCompileCommand(
                    javaFiles
                )
        };
    }

    /*
     * All other currently supported execution
     * languages use the centralized execution
     * strategy.
     */
    const runCommand =
        createRunCommand({
            language,
            filePath:
                validateProjectPath(
                    filePath
                )
        });

    return {
        command:
            runCommand.command,

        buildCommand:
            null
    };
}


export async function executeCode({
    projectId,
    filePath
}) {
    if (!projectId) {
        const error = new Error(
            "Project ID is required"
        );

        error.code =
            "PROJECT_ID_REQUIRED";

        throw error;
    }

    if (!filePath) {
        const error = new Error(
            "File path is required"
        );

        error.code =
            "FILE_PATH_REQUIRED";

        throw error;
    }

    const files =
        await getProjectFiles(
            projectId
        );

    const projectFile =
        getProjectFileByPath(
            files,
            filePath
        );

    if (!projectFile) {
        throw createFileNotFoundError(
            filePath
        );
    }

    const fileDetection =
        detectLanguageFromFile(
            projectFile.path
        );

    let language =
        fileDetection.language;

    if (!language) {
        const projectDetection =
            detectPrimaryProjectLanguage(
                files
            );

        language =
            projectDetection.language;
    }

    if (!language) {
        throw createUnsupportedLanguageError(
            "unknown"
        );
    }

    const strategy =
        getExecutionStrategy(
            language
        );

    if (
        !getSupportedExecutionLanguages()
            .includes(language)
    ) {
        throw createUnsupportedLanguageError(
            language
        );
    }

    const {
        command,
        buildCommand
    } =
        createExecutionCommand({
            language,
            filePath:
                projectFile.path,
            files,
            fileContent:
                projectFile.content
        });

    /*
     * Every execution happens inside one
     * persistent sandbox session.
     *
     * For Java:
     *
     *     build -> run
     *
     * happens in the same workspace.
     */
    const steps = [];

    if (buildCommand) {
        steps.push({
            name: "build",
            command:
                buildCommand,
            stopOnFailure: true
        });
    }

    steps.push({
        name: "execution",
        command,
        stopOnFailure: true
    });

    let sessionResult;

    try {
        sessionResult =
            await executeInSandboxSession({
                projectId,
                steps
            });
    } catch (error) {
        /*
         * Execution infrastructure errors must be
         * returned as structured execution failures
         * rather than forcing the model to invent
         * application-level workarounds.
         */
        return {
            success: false,

            language,

            runtime:
                strategy.runtime,

            filePath:
                projectFile.path,

            stage: "execution",

            build:
                buildCommand
                    ? null
                    : null,

            execution: {
                name: "execution",

                success: false,

                exitCode: null,

                stdout: "",

                stderr:
                    error?.message ??
                    "Sandbox execution failed",

                timeOut: false,

                status: "failed",

                failureType:
                    error?.code ===
                    "SANDBOX_COMMAND_NOT_ALLOWED"
                        ? "SANDBOX_FAILURE"
                        : "EXECUTION_FAILURE"
            }
        };
    }

    const buildResult =
        buildCommand
            ? (
                sessionResult.results
                    .find(
                        (result) =>
                            result.name ===
                            "build"
                    ) ?? null
            )
            : null;

    const executionResult =
        sessionResult.results
            .find(
                (result) =>
                    result.name ===
                    "execution"
            ) ?? null;

    if (
        buildCommand &&
        buildResult &&
        (
            !buildResult.success ||
            buildResult.exitCode !== 0 ||
            buildResult.timeOut
        )
    ) {
        return {
            success: false,

            language,

            runtime:
                strategy.runtime,

            filePath:
                projectFile.path,

            stage: "build",

            build:
                buildResult,

            execution:
                null
        };
    }

    return {
        success:
            sessionResult.success &&
            executionResult?.success === true &&
            (
                executionResult?.exitCode ===
                    undefined ||
                executionResult?.exitCode ===
                    null ||
                executionResult?.exitCode === 0
            ) &&
            executionResult?.timeOut !== true,

        language,

        runtime:
            strategy.runtime,

        filePath:
            projectFile.path,

        stage: "execution",

        build:
            buildResult,

        execution:
            executionResult
    };
}


export function getSupportedCodeExecutionLanguages() {
    return [
        "javascript",
        "python",
        "java"
    ];
}