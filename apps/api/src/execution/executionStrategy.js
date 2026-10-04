const EXECUTION_STRATEGIES = {
    javascript: {
        language: "javascript",
        runtime: "node",
        sourceExtensions: [".js", ".mjs", ".cjs", ".jsx"],

        build: null,

        run: ({ filePath }) => ({
            command: `node ${filePath}`
        })
    },

    typescript: {
        language: "typescript",
        runtime: "node",
        sourceExtensions: [".ts", ".mts", ".cts", ".tsx"],

        build: {
            command: "npm run build"
        },

        run: ({ filePath }) => ({
            command: `node ${filePath}`
        })
    },

    python: {
        language: "python",
        runtime: "python",
        sourceExtensions: [".py"],

        build: null,

        run: ({ filePath }) => ({
            command: `python ${filePath}`
        })
    },

    java: {
        language: "java",
        runtime: "jvm",
        sourceExtensions: [".java"],

        build: {
            command: "javac <project-java-files>"
        },

        run: ({ filePath }) => ({
            command: `java ${filePath}`
        })
    },

    c: {
        language: "c",
        runtime: "native",
        sourceExtensions: [".c", ".h"],

        build: {
            command: "cc <project-source-files>"
        },

        run: ({ filePath }) => ({
            command: `./${filePath}`
        })
    },

    cpp: {
        language: "cpp",
        runtime: "native",
        sourceExtensions: [".cpp", ".cc", ".cxx", ".hpp"],

        build: {
            command: "c++ <project-source-files>"
        },

        run: ({ filePath }) => ({
            command: `./${filePath}`
        })
    },

    csharp: {
        language: "csharp",
        runtime: "dotnet",
        sourceExtensions: [".cs"],

        build: {
            command: "dotnet build"
        },

        run: {
            command: "dotnet run"
        }
    },

    go: {
        language: "go",
        runtime: "go",
        sourceExtensions: [".go"],

        build: {
            command: "go build ./..."
        },

        run: ({ filePath }) => ({
            command: `go run ${filePath}`
        })
    },

    rust: {
        language: "rust",
        runtime: "rust",
        sourceExtensions: [".rs"],

        build: {
            command: "cargo build"
        },

        run: {
            command: "cargo run"
        }
    },

    kotlin: {
        language: "kotlin",
        runtime: "jvm",
        sourceExtensions: [".kt", ".kts"],

        build: {
            command: "gradle build"
        },

        run: {
            command: "gradle run"
        }
    },

    swift: {
        language: "swift",
        runtime: "swift",
        sourceExtensions: [".swift"],

        build: {
            command: "swift build"
        },

        run: {
            command: "swift run"
        }
    },

    php: {
        language: "php",
        runtime: "php",
        sourceExtensions: [".php"],

        build: null,

        run: ({ filePath }) => ({
            command: `php ${filePath}`
        })
    },

    ruby: {
        language: "ruby",
        runtime: "ruby",
        sourceExtensions: [".rb"],

        build: null,

        run: ({ filePath }) => ({
            command: `ruby ${filePath}`
        })
    }
};

function normalizeLanguage(language) {
    if (typeof language !== "string") {
        return "";
    }

    return language.trim().toLowerCase();
}

export function getExecutionStrategy(language) {
    const normalizedLanguage =
        normalizeLanguage(language);

    const strategy =
        EXECUTION_STRATEGIES[normalizedLanguage];

    if (!strategy) {
        const error = new Error(
            `Unsupported execution language: ${language}`
        );

        error.code = "UNSUPPORTED_EXECUTION_LANGUAGE";

        throw error;
    }

    return strategy;
}

export function hasExecutionStrategy(language) {
    const normalizedLanguage =
        normalizeLanguage(language);

    return Boolean(
        EXECUTION_STRATEGIES[normalizedLanguage]
    );
}

export function getSupportedExecutionLanguages() {
    return Object.keys(
        EXECUTION_STRATEGIES
    );
}

export function createRunCommand({
    language,
    filePath
}) {
    if (!filePath) {
        const error = new Error(
            "File path is required"
        );

        error.code = "FILE_PATH_REQUIRED";

        throw error;
    }

    const strategy =
        getExecutionStrategy(language);

    if (typeof strategy.run === "function") {
        return strategy.run({
            filePath
        });
    }

    if (strategy.run?.command) {
        return {
            command: strategy.run.command
        };
    }

    const error = new Error(
        `No run strategy defined for ${language}`
    );

    error.code = "RUN_STRATEGY_NOT_DEFINED";

    throw error;
}

export function getBuildCommand(language) {
    const strategy =
        getExecutionStrategy(language);

    if (!strategy.build) {
        return null;
    }

    return strategy.build.command;
}