const EXECUTION_STRATEGIES = {
    javascript: {
        language: "javascript",
        runtime: "node",

        sourceExtensions: [
            ".js",
            ".mjs",
            ".cjs",
            ".jsx"
        ],

        build: null,

        run: ({ filePath }) => ({
            command: `node "${filePath}"`
        })
    },

    typescript: {
        language: "typescript",
        runtime: "node",

        sourceExtensions: [
            ".ts",
            ".mts",
            ".cts",
            ".tsx"
        ],

        build: {
            command: "npx tsc --pretty false"
        },

        run: ({ filePath }) => ({
            command: `node "${filePath
                .replace(/\.(mts|cts|tsx|ts)$/i, ".js")}"`
        })
    },

    python: {
        language: "python",
        runtime: "python3",

        sourceExtensions: [
            ".py"
        ],

        build: null,

        run: ({ filePath }) => ({
            command: `python3 "${filePath}"`
        })
    },

    java: {
        language: "java",
        runtime: "jvm",

        sourceExtensions: [
            ".java"
        ],

        build: {
            type: "java",
            command: "javac <project-java-files>"
        },

        run: ({
            filePath,
            packageName
        }) => {
            const className =
                filePath
                    .split("/")
                    .pop()
                    .replace(/\.java$/i, "");

            const mainClass =
                packageName
                    ? `${packageName}.${className}`
                    : className;

            return {
                command: `java "${mainClass}"`
            };
        }
    },

    c: {
        language: "c",
        runtime: "native",

        sourceExtensions: [
            ".c"
        ],

        build: {
            type: "c",
            command:
                "cc <project-c-files> -o .forgeai-c-program"
        },

        run: {
            command:
                "./.forgeai-c-program"
        }
    },

    cpp: {
        language: "cpp",
        runtime: "native",

        sourceExtensions: [
            ".cpp",
            ".cc",
            ".cxx"
        ],

        build: {
            type: "cpp",
            command:
                "c++ <project-cpp-files> -o .forgeai-cpp-program"
        },

        run: {
            command:
                "./.forgeai-cpp-program"
        }
    },

    csharp: {
        language: "csharp",
        runtime: "dotnet",

        sourceExtensions: [
            ".cs"
        ],

        build: {
            type: "dotnet",
            command: "dotnet build"
        },

        run: {
            command:
                "dotnet run --no-build"
        }
    },

    go: {
        language: "go",
        runtime: "go",

        sourceExtensions: [
            ".go"
        ],

        build: null,

        run: ({ filePath }) => ({
            command:
                `go run "${filePath}"`
        })
    },

    rust: {
        language: "rust",
        runtime: "rust",

        sourceExtensions: [
            ".rs"
        ],

        build: {
            type: "rust",
            command:
                "rustc <file> -o .forgeai-rust-program"
        },

        run: {
            command:
                "./.forgeai-rust-program"
        }
    },

    kotlin: {
        language: "kotlin",
        runtime: "jvm",

        sourceExtensions: [
            ".kt",
            ".kts"
        ],

        build: {
            type: "kotlin",
            command:
                "kotlinc <file> -include-runtime -d .forgeai-kotlin.jar"
        },

        run: {
            command:
                "java -jar .forgeai-kotlin.jar"
        }
    },

    swift: {
        language: "swift",
        runtime: "swift",

        sourceExtensions: [
            ".swift"
        ],

        build: null,

        run: ({ filePath }) => ({
            command:
                `swift "${filePath}"`
        })
    },

    php: {
        language: "php",
        runtime: "php",

        sourceExtensions: [
            ".php"
        ],

        build: null,

        run: ({ filePath }) => ({
            command:
                `php "${filePath}"`
        })
    },

    ruby: {
        language: "ruby",
        runtime: "ruby",

        sourceExtensions: [
            ".rb"
        ],

        build: null,

        run: ({ filePath }) => ({
            command:
                `ruby "${filePath}"`
        })
    }
};


function normalizeLanguage(language) {
    if (typeof language !== "string") {
        return "";
    }

    const normalized =
        language
            .trim()
            .toLowerCase();

    const aliases = {
        js: "javascript",
        node: "javascript",
        nodejs: "javascript",

        ts: "typescript",

        py: "python",
        python3: "python",

        "c++": "cpp",
        cplusplus: "cpp",

        "c#": "csharp",
        cs: "csharp",

        golang: "go",

        rs: "rust",

        kt: "kotlin",

        rb: "ruby"
    };

    return aliases[normalized] ?? normalized;
}


export function getExecutionStrategy(language) {
    const normalizedLanguage =
        normalizeLanguage(language);

    const strategy =
        EXECUTION_STRATEGIES[
            normalizedLanguage
        ];

    if (!strategy) {
        const error = new Error(
            `Unsupported execution language: ${language}`
        );

        error.code =
            "UNSUPPORTED_EXECUTION_LANGUAGE";

        throw error;
    }

    return strategy;
}


export function hasExecutionStrategy(language) {
    const normalizedLanguage =
        normalizeLanguage(language);

    return Boolean(
        EXECUTION_STRATEGIES[
            normalizedLanguage
        ]
    );
}


export function getSupportedExecutionLanguages() {
    return Object.keys(
        EXECUTION_STRATEGIES
    );
}


export function createRunCommand({
    language,
    filePath,
    packageName
}) {
    if (!filePath) {
        const error = new Error(
            "File path is required"
        );

        error.code =
            "FILE_PATH_REQUIRED";

        throw error;
    }

    const strategy =
        getExecutionStrategy(language);

    if (typeof strategy.run === "function") {
        return strategy.run({
            filePath,
            packageName
        });
    }

    if (strategy.run?.command) {
        return {
            command:
                strategy.run.command
        };
    }

    const error = new Error(
        `No run strategy defined for ${language}`
    );

    error.code =
        "RUN_STRATEGY_NOT_DEFINED";

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