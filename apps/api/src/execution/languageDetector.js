const EXTENSION_LANGUAGE_MAP = {
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",

    ".ts": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",

    ".py": "python",

    ".java": "java",

    ".c": "c",
    ".h": "c",

    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",

    ".cs": "csharp",

    ".go": "go",

    ".rs": "rust",

    ".kt": "kotlin",
    ".kts": "kotlin",

    ".swift": "swift",

    ".php": "php",

    ".rb": "ruby",

    ".sql": "sql"
};

const PROJECT_MARKERS = [
    {
        fileName: "package.json",
        language: "javascript"
    },
    {
        fileName: "tsconfig.json",
        language: "typescript"
    },
    {
        fileName: "pom.xml",
        language: "java"
    },
    {
        fileName: "build.gradle",
        language: "java"
    },
    {
        fileName: "build.gradle.kts",
        language: "kotlin"
    },
    {
        fileName: "requirements.txt",
        language: "python"
    },
    {
        fileName: "pyproject.toml",
        language: "python"
    },
    {
        fileName: "go.mod",
        language: "go"
    },
    {
        fileName: "Cargo.toml",
        language: "rust"
    },
    {
        fileName: "composer.json",
        language: "php"
    },
    {
        fileName: "Gemfile",
        language: "ruby"
    }
];

function normalizePath(filePath) {
    return String(filePath)
        .replace(/\\/g, "/")
        .trim();
}

function getFileName(filePath) {
    const normalizedPath = normalizePath(filePath);

    const lastSlashIndex =
        normalizedPath.lastIndexOf("/");

    return lastSlashIndex === -1
        ? normalizedPath
        : normalizedPath.slice(lastSlashIndex + 1);
}

function getExtension(filePath) {
    const fileName = getFileName(filePath);
    const lastDotIndex = fileName.lastIndexOf(".");

    if (
        lastDotIndex === -1 ||
        lastDotIndex === 0
    ) {
        return "";
    }

    return fileName
        .slice(lastDotIndex)
        .toLowerCase();
}

export function detectLanguageFromFile(filePath) {
    if (
        typeof filePath !== "string" ||
        !filePath.trim()
    ) {
        return {
            language: null,
            confidence: "none",
            source: null,
            filePath: filePath ?? null
        };
    }

    const normalizedPath =
        normalizePath(filePath);

    const extension =
        getExtension(normalizedPath);

    const language =
        EXTENSION_LANGUAGE_MAP[extension];

    if (!language) {
        return {
            language: null,
            confidence: "none",
            source: "extension",
            filePath: normalizedPath
        };
    }

    return {
        language,
        confidence: "high",
        source: "extension",
        filePath: normalizedPath
    };
}

export function detectProjectLanguages(files = []) {
    if (!Array.isArray(files)) {
        throw new TypeError(
            "Project files must be an array"
        );
    }

    const detectedLanguages = new Map();

    for (const file of files) {
        const filePath =
            typeof file === "string"
                ? file
                : file?.path;

        if (!filePath) {
            continue;
        }

        const detection =
            detectLanguageFromFile(filePath);

        if (!detection.language) {
            continue;
        }

        const existing =
            detectedLanguages.get(
                detection.language
            ) ?? 0;

        detectedLanguages.set(
            detection.language,
            existing + 1
        );
    }

    for (const marker of PROJECT_MARKERS) {
        const markerExists = files.some(
            (file) => {
                const filePath =
                    typeof file === "string"
                        ? file
                        : file?.path;

                if (!filePath) {
                    return false;
                }

                return (
                    getFileName(filePath) ===
                    marker.fileName
                );
            }
        );

        if (!markerExists) {
            continue;
        }

        const existing =
            detectedLanguages.get(
                marker.language
            ) ?? 0;

        /*
         * Project markers receive a strong
         * weight because they identify the
         * project's toolchain directly.
         */
        detectedLanguages.set(
            marker.language,
            existing + 10
        );
    }

    return [...detectedLanguages.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([language, score]) => ({
            language,
            score
        }));
}

export function detectPrimaryProjectLanguage(
    files = []
) {
    const languages =
        detectProjectLanguages(files);

    if (languages.length === 0) {
        return {
            language: null,
            confidence: "none",
            languages: []
        };
    }

    const primary =
        languages[0];

    const second =
        languages[1];

    let confidence = "medium";

    if (
        primary.score >= 10 &&
        (
            !second ||
            primary.score >= second.score * 2
        )
    ) {
        confidence = "high";
    }

    return {
        language: primary.language,
        confidence,
        languages
    };
}

export function getSupportedLanguages() {
    return [
        "javascript",
        "typescript",
        "python",
        "java",
        "c",
        "cpp",
        "csharp",
        "go",
        "rust",
        "kotlin",
        "swift",
        "php",
        "ruby",
        "sql"
    ];
}