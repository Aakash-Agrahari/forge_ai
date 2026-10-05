const ALLOWED_SIMPLE_COMMANDS = new Set([
    "npm test",
    "npm run build",
    "npm run lint",
    "git status",
    "node --test"
]);

const ALLOWED_RUNTIME_COMMANDS = [
    /^node\s+([A-Za-z0-9._/-]+\.m?js)$/,
    /^python\s+([A-Za-z0-9._/-]+\.py)$/,
    /^php\s+([A-Za-z0-9._/-]+\.php)$/,
    /^ruby\s+([A-Za-z0-9._/-]+\.rb)$/,
    /^java\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/
];

function normalizeCommand(command) {
    return command.trim().replace(/\s+/g, " ");
}

function validateJavaCompileCommand(command) {
    const normalized = normalizeCommand(command);

    if (!normalized.startsWith("javac ")) {
        return false;
    }

    const sourcePart = normalized.slice("javac ".length).trim();

    if (!sourcePart) {
        return false;
    }

    const sourceFiles = sourcePart
        .split(/\s+/)
        .map((file) => file.replace(/^"|"$/g, ""));

    if (sourceFiles.length === 0) {
        return false;
    }

    return sourceFiles.every((file) => {
        if (!file.endsWith(".java")) {
            return false;
        }

        if (file.startsWith("/")) {
            return false;
        }

        if (file.includes("..")) {
            return false;
        }

        if (file.includes("\\") || file.includes(";")) {
            return false;
        }

        return /^[A-Za-z0-9._/-]+\.java$/.test(file);
    });
}

function validateRuntimeCommand(command) {
    return ALLOWED_RUNTIME_COMMANDS.some((pattern) =>
        pattern.test(command)
    );
}

export function validateSandboxCommand(command) {
    if (typeof command !== "string" || !command.trim()) {
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