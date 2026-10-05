const ALLOWED_SIMPLE_COMMANDS = new Set([
    "npm test",
    "npm run build",
    "npm run lint",
    "git status",
    "node --test"
]);

const ALLOWED_RUNTIME_COMMANDS = [
    /^node\s+[A-Za-z0-9._/-]+\.m?js$/,
    /^python\s+[A-Za-z0-9._/-]+\.py$/,
    /^php\s+[A-Za-z0-9._/-]+\.php$/,
    /^ruby\s+[A-Za-z0-9._/-]+\.rb$/,
    /^java\s+[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/
];

const SANDBOX_LIMITS = {
    maxTimeoutMs: 30_000,
    maxOutputBytes: 1_000_000
};

function normalizeCommand(command) {
    return command.trim().replace(/\s+/g, " ");
}

function parseJavaSourceArguments(command) {
    const sourcePart = command
        .slice("javac".length)
        .trim();

    if (!sourcePart) {
        return [];
    }

    return (
        sourcePart
            .match(/"[^"]+"|\S+/g)
            ?.map((file) => {
                if (
                    file.startsWith('"') &&
                    file.endsWith('"')
                ) {
                    return file.slice(1, -1);
                }

                return file;
            }) ?? []
    );
}

function isSafeRelativeJavaPath(filePath) {
    if (!filePath) {
        return false;
    }

    if (filePath.startsWith("/")) {
        return false;
    }

    if (filePath.includes("\\")) {
        return false;
    }

    if (filePath.includes("..")) {
        return false;
    }

    if (filePath.includes(";")) {
        return false;
    }

    if (filePath.includes("|")) {
        return false;
    }

    if (filePath.includes("&")) {
        return false;
    }

    if (filePath.includes(">")) {
        return false;
    }

    if (filePath.includes("<")) {
        return false;
    }

    if (filePath.includes("$")) {
        return false;
    }

    if (!filePath.endsWith(".java")) {
        return false;
    }

    return /^[A-Za-z0-9._/-]+\.java$/.test(filePath);
}

function validateJavaCompileCommand(command) {
    if (!command.startsWith("javac ")) {
        return false;
    }

    const sourceFiles = parseJavaSourceArguments(command);

    if (sourceFiles.length === 0) {
        return false;
    }

    return sourceFiles.every(isSafeRelativeJavaPath);
}

function validateRuntimeCommand(command) {
    return ALLOWED_RUNTIME_COMMANDS.some((pattern) =>
        pattern.test(command)
    );
}

export function validateSandboxCommand(command) {
    if (
        typeof command !== "string" ||
        !command.trim()
    ) {
        const error = new Error(
            "Sandbox command must be a non-empty string"
        );

        error.code = "SANDBOX_COMMAND_REQUIRED";

        throw error;
    }

    const normalized = normalizeCommand(command);

    if (ALLOWED_SIMPLE_COMMANDS.has(normalized)) {
        return normalized;
    }

    if (validateJavaCompileCommand(normalized)) {
        return normalized;
    }

    if (validateRuntimeCommand(normalized)) {
        return normalized;
    }

    const error = new Error(
        `Command is not allowed in the sandbox: ${command}`
    );

    error.code = "SANDBOX_COMMAND_NOT_ALLOWED";

    throw error;
}

export function getSandboxLimits() {
    return {
        ...SANDBOX_LIMITS
    };
}