const ALLOWED_COMMANDS = new Set([
    "npm test",
    "npm run build",
    "npm run lint",
    "git status",
    "node --test"
]);

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 1_000_000;

function isSafeNodeCommand(command) {
    if (!command.startsWith("node ")) {
        return false;
    }

    const filePath = command.slice(5).trim();

    if (!filePath) {
        return false;
    }

    // Only allow a simple project-relative JavaScript file.
    if (!filePath.endsWith(".js")) {
        return false;
    }

    // Prevent shell flags, command chaining and absolute paths.
    if (
        filePath.startsWith("-") ||
        filePath.includes("&&") ||
        filePath.includes("||") ||
        filePath.includes(";") ||
        filePath.includes("|") ||
        filePath.includes(">") ||
        filePath.includes("<") ||
        pathIsAbsolute(filePath)
    ) {
        return false;
    }

    // Prevent directory traversal.
    const segments = filePath.split(/[\\/]+/);

    if (segments.includes("..")) {
        return false;
    }

    return true;
}

function pathIsAbsolute(filePath) {
    return (
        filePath.startsWith("/") ||
        filePath.startsWith("\\") ||
        /^[A-Za-z]:[\\/]/.test(filePath)
    );
}

export function validateSandboxCommand(command) {
    if (typeof command !== "string") {
        const error = new Error(
            "Sandbox command must be a string"
        );

        error.code = "INVALID_SANDBOX_COMMAND";

        throw error;
    }

    const normalizedCommand = command.trim();

    if (!normalizedCommand) {
        const error = new Error(
            "Sandbox command cannot be empty"
        );

        error.code = "EMPTY_SANDBOX_COMMAND";

        throw error;
    }

    const isExplicitlyAllowed =
        ALLOWED_COMMANDS.has(normalizedCommand);

    const isAllowedNodeCommand =
        isSafeNodeCommand(normalizedCommand);

    if (!isExplicitlyAllowed && !isAllowedNodeCommand) {
        const error = new Error(
            `Command is not allowed in the sandbox: ${normalizedCommand}`
        );

        error.code = "SANDBOX_COMMAND_NOT_ALLOWED";

        throw error;
    }

    return normalizedCommand;
}

export function getSandboxLimits({
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputBytes = MAX_OUTPUT_BYTES
} = {}) {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
        const error = new Error(
            "Sandbox timeout must be a positive integer"
        );

        error.code = "INVALID_SANDBOX_TIMEOUT";

        throw error;
    }

    if (timeoutMs > MAX_TIMEOUT_MS) {
        const error = new Error(
            `Sandbox timeout cannot exceed ${MAX_TIMEOUT_MS}ms`
        );

        error.code = "SANDBOX_TIMEOUT_TOO_LARGE";

        throw error;
    }

    if (!Number.isInteger(maxOutputBytes) || maxOutputBytes <= 0) {
        const error = new Error(
            "Sandbox max output must be a positive integer"
        );

        error.code = "INVALID_SANDBOX_OUTPUT_LIMIT";

        throw error;
    }

    return {
        timeoutMs,
        maxOutputBytes
    };
}

export function getAllowedSandboxCommands() {
    return [
        ...ALLOWED_COMMANDS,
        "node <project-relative-file>.js"
    ];
}