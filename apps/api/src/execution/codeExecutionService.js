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


/**
 * Extract the Java package name from source code.
 *
 * This is kept as a small language-specific parser,
 * not as an execution strategy.
 *
 * Example:
 *
 * package com.example.app;
 *
 * returns:
 *
 * com.example.app
 */
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

function hasJavaMainMethod(
    content
) {
    if (typeof content !== "string") {
        return false;
    }

    return /\bpublic\s+static\s+void\s+main\s*\(\s*String\s*(?:\[\s*\]|\.\.\.)\s+\w+\s*\)/.test(
        content
    );
}


function getJavaClassName(
    filePath
) {
    const fileName =
        filePath
            .split("/")
            .pop();

    return fileName
        .replace(/\.java$/i, "");
}


function getJavaMainClass(
    filePath,
    content
) {
    const packageName =
        getJavaPackageName(content);

    const className =
        getJavaClassName(filePath);

    return packageName
        ? `${packageName}.${className}`
        : className;
}


/**
 * Get project source files matching the requested
 * source extensions.
 */
function getProjectSourceFiles(
    files,
    extensions
) {
    const normalizedExtensions =
        extensions.map(
            (extension) =>
                extension.toLowerCase()
        );

    return files
        .filter(
            (file) => {
                if (
                    typeof file.path !==
                    "string"
                ) {
                    return false;
                }

                const normalizedPath =
                    file.path.toLowerCase();

                return normalizedExtensions.some(
                    (extension) =>
                        normalizedPath.endsWith(
                            extension
                        )
                );
            }
        )
        .map(
            (file) =>
                validateProjectPath(
                    file.path
                )
        );
}

function getJavaImports(content) {
    if (typeof content !== "string") {
        return [];
    }

    const imports = [];

    const importRegex =
        /^\s*import\s+(?:static\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*;/gm;

    let match;

    while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
    }

    return imports;
}


function getJavaTypeReferences(content) {
    if (typeof content !== "string") {
        return [];
    }

    const references = new Set();

    const typeRegex =
        /\b(?:class|interface|enum|record)\s+([A-Za-z_][A-Za-z0-9_]*)|\bnew\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

    let match;

    while ((match = typeRegex.exec(content)) !== null) {
        const typeName = match[1] ?? match[2];

        if (typeName) {
            references.add(typeName);
        }
    }

    return [...references];
}


function getJavaSourceDependencies(
    files,
    requestedFile
) {
    const javaFiles =
        files.filter(
            (file) =>
                typeof file.path === "string" &&
                file.path
                    .toLowerCase()
                    .endsWith(".java")
        );

    const fileByPath =
        new Map(
            javaFiles.map(
                (file) => [
                    validateProjectPath(file.path),
                    file
                ]
            )
        );

    const selected = new Map();

    const queue = [
        validateProjectPath(requestedFile.path)
    ];

    while (queue.length > 0) {
        const currentPath = queue.shift();

        if (selected.has(currentPath)) {
            continue;
        }

        const currentFile =
            fileByPath.get(currentPath);

        if (!currentFile) {
            continue;
        }

        selected.set(
            currentPath,
            currentFile
        );

        const packageName =
            getJavaPackageName(
                currentFile.content
            );

        const imports =
            getJavaImports(
                currentFile.content
            );

        const typeReferences =
            getJavaTypeReferences(
                currentFile.content
            );

        /*
         * 1. Resolve explicit imports.
         */
        for (const importName of imports) {
            if (importName.endsWith(".*")) {
                continue;
            }

            const importedClass =
                importName.split(".").pop();

            for (const file of javaFiles) {
                const className =
                    getJavaClassName(file.path);

                if (className !== importedClass) {
                    continue;
                }

                const normalizedPath =
                    validateProjectPath(
                        file.path
                    );

                if (!selected.has(normalizedPath)) {
                    queue.push(normalizedPath);
                }
            }
        }

        /*
         * 2. Resolve classes in the same package.
         */
        for (const file of javaFiles) {
            const normalizedPath =
                validateProjectPath(file.path);

            if (selected.has(normalizedPath)) {
                continue;
            }

            const filePackage =
                getJavaPackageName(
                    file.content
                );

            if (
                filePackage &&
                filePackage === packageName
            ) {
                const className =
                    getJavaClassName(file.path);

                if (
                    typeReferences.includes(
                        className
                    )
                ) {
                    queue.push(normalizedPath);
                }
            }
        }
    }

    return [...selected.values()]
        .map(
            (file) =>
                validateProjectPath(
                    file.path
                )
        );
}

/**
 * Convert project source paths into
 * safely quoted command arguments.
 */
function createProjectSourceArguments(
    files
) {
    return files
        .map(
            (filePath) =>
                `"${filePath}"`
        )
        .join(" ");
}


/**
 * Create the build command from the
 * centralized execution strategy.
 *
 * The execution strategy defines WHAT
 * kind of build is required.
 *
 * This service only expands project-specific
 * placeholders such as source files.
 */
function createBuildCommand({
    language,
    strategy,
    files,
    filePath
}) {
    if (!strategy.build) {
        return null;
    }

    const buildType =
        strategy.build.type;

        if (buildType === "java") {
            const requestedFile =
                getProjectFileByPath(
                    files,
                    filePath
                );

            if (!requestedFile) {
                throw createFileNotFoundError(
                    filePath
                );
            }

            const javaFiles =
                getJavaSourceDependencies(
                    files,
                    requestedFile
                );

            if (javaFiles.length === 0) {
                const error = new Error(
                    "No Java source files found in project"
                );

                error.code =
                    "NO_JAVA_SOURCE_FILES";

                throw error;
            }

            return strategy.build.command.replace(
                "<project-java-files>",
                createProjectSourceArguments(
                    javaFiles
                )
            );
        }


    if (buildType === "c") {
        const cFiles =
            getProjectSourceFiles(
                files,
                [".c"]
            );

        if (cFiles.length === 0) {
            const error = new Error(
                "No C source files found in project"
            );

            error.code =
                "NO_C_SOURCE_FILES";

            throw error;
        }

        return strategy.build.command.replace(
            "<project-c-files>",
            createProjectSourceArguments(
                cFiles
            )
        );
    }


    if (buildType === "cpp") {
        const cppFiles =
            getProjectSourceFiles(
                files,
                [
                    ".cpp",
                    ".cc",
                    ".cxx"
                ]
            );

        if (cppFiles.length === 0) {
            const error = new Error(
                "No C++ source files found in project"
            );

            error.code =
                "NO_CPP_SOURCE_FILES";

            throw error;
        }

        return strategy.build.command.replace(
            "<project-cpp-files>",
            createProjectSourceArguments(
                cppFiles
            )
        );
    }


    if (buildType === "rust") {
        return strategy.build.command.replace(
            "<file>",
            `"${validateProjectPath(
                filePath
            )}"`
        );
    }


    if (buildType === "kotlin") {
        return strategy.build.command.replace(
            "<file>",
            `"${validateProjectPath(
                filePath
            )}"`
        );
    }


    /*
     * TypeScript, C#, and any future build
     * strategy that does not require project
     * source expansion simply uses its command.
     */
    return strategy.build.command;
}


/**
 * Create the complete execution plan.
 *
 * The LLM does not decide the command.
 *
 * Flow:
 *
 * language
 *    ↓
 * executionStrategy
 *    ↓
 * build command
 *    ↓
 * run command
 */
function createExecutionCommand({
    language,
    filePath,
    files,
    fileContent,
    strategy
}) {
    const normalizedFilePath =
        validateProjectPath(
            filePath
        );

    if (language === "java") {
        const isExecutable =
            hasJavaMainMethod(
                fileContent
            );

        const mainClass =
            isExecutable
                ? getJavaMainClass(
                    normalizedFilePath,
                    fileContent
                )
                : null;

        const buildCommand =
            createBuildCommand({
                language,
                strategy,
                files,
                filePath:
                    normalizedFilePath
            });

        const runCommand =
            isExecutable
                ? createRunCommand({
                    language,
                    filePath:
                        normalizedFilePath,
                    mainClass
                })
                : null;

        return {
            command:
                runCommand?.command ??
                null,

            buildCommand,

            isExecutable
        };
    }

    const packageName =
        language === "java"
            ? getJavaPackageName(
                fileContent
            )
            : null;

    const runCommand =
        createRunCommand({
            language,
            filePath:
                normalizedFilePath,
            packageName
        });

    const buildCommand =
        createBuildCommand({
            language,
            strategy,
            files,
            filePath:
                normalizedFilePath
        });

    return {
        command:
            runCommand.command,

        buildCommand,

        isExecutable: true
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


    /*
     * Load the complete project because some
     * languages require multiple source files
     * during compilation.
     */

    console.log("[EXECUTE_CODE]", {
        projectId,
        requestedFilePath: filePath,
    });

    const files =
        await getProjectFiles(
            projectId
        );

    console.log(
        "[EXECUTE_CODE_PROJECT_FILES]",
        files.map((file) => file.path)
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


    /*
     * First try to determine the language
     * from the requested file itself.
     */
    const fileDetection =
        detectLanguageFromFile(
            projectFile.path
        );


    let language =
        fileDetection.language;


    /*
     * If the file extension does not provide
     * enough information, fall back to the
     * primary project language.
     */
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


    /*
     * Resolve the centralized execution strategy.
     */
    const strategy =
        getExecutionStrategy(
            language
        );


    if (!strategy) {
        throw createUnsupportedLanguageError(
            language
        );
    }


    /*
     * Keep this check centralized against
     * executionStrategy.js.
     */
    if (
        !getSupportedExecutionLanguages()
            .includes(language)
    ) {
        throw createUnsupportedLanguageError(
            language
        );
    }


    /*
     * Build the complete execution plan.
     *
     * This is where:
     *
     *     language
     *        ↓
     *     strategy
     *        ↓
     *     build
     *        ↓
     *     run
     *
     * is resolved.
     */
    const {
        command,
        buildCommand,
        isExecutable
    } =
        createExecutionCommand({
            language,
            filePath:
                projectFile.path,
            files,
            fileContent:
                projectFile.content,
            strategy
        });


    /*
     * Every build and execution operation
     * happens inside ONE persistent sandbox
     * session.
     *
     * This is important because build artifacts
     * must remain available to the execution step.
     *
     * Example:
     *
     * Java:
     *
     *     javac Main.java
     *          ↓
     *     java Main
     *
     * C:
     *
     *     cc main.c -o .forgeai-c-program
     *          ↓
     *     ./.forgeai-c-program
     *
     * Rust:
     *
     *     rustc main.rs -o .forgeai-rust-program
     *          ↓
     *     ./.forgeai-rust-program
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


    if (isExecutable) {
        steps.push({
            name: "execution",

            command,

            stopOnFailure: true
        });
    }


    let sessionResult;


    try {
        sessionResult =
            await executeInSandboxSession({
                projectId,
                steps
            });
    } catch (error) {
        /*
        * Sandbox infrastructure errors are
        * returned as structured execution
        * failures.
        */
        return {
            success: false,

            language,

            runtime:
                strategy.runtime,

            filePath:
                projectFile.path,

            stage:
                "execution",

            build:
                null,

            execution: {
                name:
                    "execution",

                success:
                    false,

                exitCode:
                    null,

                stdout:
                    "",

                stderr:
                    error?.message ??
                    "Sandbox execution failed",

                timeOut:
                    false,

                status:
                    "failed",

                failureType:
                    error?.code ===
                    "SANDBOX_COMMAND_NOT_ALLOWED"
                        ? "SANDBOX_FAILURE"
                        : "EXECUTION_FAILURE"
            }
        };
    }


    /*
     * Extract the build result.
     */
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


    /*
     * Extract the actual execution result.
     */
    const executionResult =
        sessionResult.results
            .find(
                (result) =>
                    result.name ===
                    "execution"
            ) ?? null;


    /*
     * If the build failed, do NOT execute
     * the program.
     */
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

            stage:
                "build",

            build:
                buildResult,

            execution:
                null
        };
    }


    /*
     * Final normalized execution result.
     *
     * success is true only when:
     *
     * - sandbox succeeded
     * - execution step succeeded
     * - exit code is 0
     * - execution did not timeout
     */
    return {
        success:
            sessionResult.success &&
            (
                !isExecutable ||
                (
                    executionResult?.success === true &&
                    (
                        executionResult?.exitCode ===
                            undefined ||
                        executionResult?.exitCode ===
                            null ||
                        executionResult?.exitCode === 0
                    ) &&
                    executionResult?.timeOut !== true
                )
            ),

        language,

        runtime:
            strategy.runtime,

        filePath:
            projectFile.path,

        stage:
            "execution",

        build:
            buildResult,

        execution:
            executionResult
    };
}


export function getSupportedCodeExecutionLanguages() {
    return getSupportedExecutionLanguages();
}