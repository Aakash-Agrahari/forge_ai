import path from "node:path";

import { getProjectFiles } from "../services/fileService.js";
import { validateProjectPath } from "../agent/projectPath.js";
import { executeProjectCommand } from "../sandbox/sandboxService.js";

import {
    detectPrimaryProjectLanguage,
    detectLanguageFromFile
} from "./languageDetector.js";

import {
    getExecutionStrategy
} from "./executionStrategy.js";

function createUnsupportedLanguageError(language) {
    const error = new Error(
        `Unsupported execution language: ${language}`
    );

    error.code = "UNSUPPORTED_EXECUTION_LANGUAGE";
    error.statusCode = 400;

    return error;
}

function createFileNotFoundError(filePath) {
    const error = new Error(
        `Project file not found: ${filePath}`
    );

    error.code = "EXECUTION_FILE_NOT_FOUND";
    error.statusCode = 404;

    return error;
}

function getProjectFileByPath(files, filePath) {
    const normalizedPath =
        validateProjectPath(filePath);

    return files.find(
        (file) =>
            validateProjectPath(file.path) ===
            normalizedPath
    );
}

function getJavaClassName(filePath) {
    const normalizedPath =
        validateProjectPath(filePath);

    const fileName =
        path.posix.basename(normalizedPath);

    if (!fileName.endsWith(".java")) {
        const error = new Error(
            "Java execution requires a .java file"
        );

        error.code = "INVALID_JAVA_FILE";
        throw error;
    }

    return fileName.slice(
        0,
        -".java".length
    );
}

function getJavaPackageName(content) {
    if (typeof content !== "string") {
        return null;
    }

    const match =
        content.match(
            /^\s*package\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/m
        );

    return match?.[1] ?? null;
}

function getJavaSourceFiles(files) {
    return files
        .filter(
            (file) =>
                typeof file.path === "string" &&
                file.path.toLowerCase().endsWith(".java")
        )
        .map((file) =>
            validateProjectPath(file.path)
        );
}

function getPythonCommand(filePath) {
    const normalizedPath =
        validateProjectPath(filePath);

    return `python ${normalizedPath}`;
}

function getJavaScriptCommand(filePath) {
    const normalizedPath =
        validateProjectPath(filePath);

    return `node ${normalizedPath}`;
}

function getJavaCompileCommand(javaFiles) {
    if (javaFiles.length === 0) {
        const error = new Error(
            "No Java source files found in project"
        );

        error.code = "NO_JAVA_SOURCE_FILES";

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
        getJavaClassName(filePath);

    const packageName =
        getJavaPackageName(content);

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
    switch (language) {
        case "javascript":
            return {
                command:
                    getJavaScriptCommand(
                        filePath
                    ),
                buildCommand: null
            };

        case "python":
            return {
                command:
                    getPythonCommand(
                        filePath
                    ),
                buildCommand: null
            };

        case "java": {
            const javaFiles =
                getJavaSourceFiles(files);

            return {
                command:
                    getJavaRunCommand({
                        filePath,
                        content: fileContent
                    }),
                buildCommand:
                    getJavaCompileCommand(
                        javaFiles
                    )
            };
        }

        default:
            throw createUnsupportedLanguageError(
                language
            );
    }
}

export async function executeCode({
    projectId,
    filePath
}) {
    if (!projectId) {
        const error = new Error(
            "Project ID is required"
        );

        error.code = "PROJECT_ID_REQUIRED";
        throw error;
    }

    if (!filePath) {
        const error = new Error(
            "File path is required"
        );

        error.code = "FILE_PATH_REQUIRED";
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

    /*
     * At this stage we intentionally support
     * real execution for JavaScript, Python,
     * and Java only.
     *
     * Other strategies exist, but their
     * compiler/runtime integration will be
     * added one language at a time after the
     * generic contract is proven.
     */
    const supportedLanguages = new Set([
        "javascript",
        "python",
        "java"
    ]);

    if (!supportedLanguages.has(language)) {
        throw createUnsupportedLanguageError(
            language
        );
    }

    const {
        command,
        buildCommand
    } = createExecutionCommand({
        language,
        filePath:
            projectFile.path,
        files,
        fileContent:
            projectFile.content
    });

    let buildResult = null;

    if (buildCommand) {
        buildResult =
            await executeProjectCommand({
                projectId,
                command:
                    buildCommand
            });

        if (
            !buildResult.success ||
            buildResult.exitCode !== 0 ||
            buildResult.timeOut
        ) {
            return {
                success: false,
                language,
                filePath:
                    projectFile.path,
                stage: "build",
                build: buildResult,
                execution: null
            };
        }
    }

    const executionResult =
        await executeProjectCommand({
            projectId,
            command
        });

    return {
        success:
            executionResult.success &&
            executionResult.exitCode === 0 &&
            !executionResult.timeOut,

        language,

        runtime:
            strategy.runtime,

        filePath:
            projectFile.path,

        stage: "execution",

        build: buildResult,

        execution: executionResult
    };
}

export function getSupportedCodeExecutionLanguages() {
    return [
        "javascript",
        "python",
        "java"
    ];
}