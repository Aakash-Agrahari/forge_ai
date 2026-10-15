import path from "node:path";

const ALLOWED_COMMANDS = new Set([
    "npm test",
    "npm run build",
    "npm run lint",
    "git status",
    "node --test"
]);

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_OUTPUT_BYTES = 1_000_000;

function extractCommandArguments(command, pattern) {
    const match = command.match(pattern);

    if (!match) {
        return null;
    }

    return match
        .slice(1)
        .filter((value) => value !== undefined);
}

function isSafeProjectFilePath(filePath) {
    if (!filePath) {
        return false;
    }

    if (
        filePath.startsWith("-") ||
        filePath.includes("&&") ||
        filePath.includes("||") ||
        filePath.includes(";") ||
        filePath.includes("|") ||
        filePath.includes(">") ||
        filePath.includes("<") ||
        filePath.includes("$(") ||
        filePath.includes("`")
    ) {
        return false;
    }

    if (pathIsAbsolute(filePath)) {
        return false;
    }

    const segments = filePath.split(/[\\/]+/);

    if (segments.includes("..")) {
        return false;
    }

    return true;
}

function isSafeOutputPath(filePath) {
    return (
        isSafeProjectFilePath(filePath) &&
        !filePath.includes("/")
            ? true
            : isSafeProjectFilePath(filePath)
    );
}

function pathIsAbsolute(filePath) {
    return (
        filePath.startsWith("/") ||
        filePath.startsWith("\\") ||
        /^[A-Za-z]:[\\/]/.test(filePath)
    );
}

function isSafeFileList(fileList) {
    if (!fileList || fileList.length === 0) {
        return false;
    }

    return fileList.every(
        (filePath) =>
            isSafeProjectFilePath(filePath)
    );
}

function isSafeNodeCommand(command) {
    const args = extractCommandArguments(
        command,
        /^node\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))$/
    );

    if (!args || args.length !== 1) {
        return false;
    }

    const filePath = args[0];

    const supportedExtensions = [
        ".js",
        ".mjs",
        ".cjs",
        ".jsx"
    ];

    if (
        !supportedExtensions.some(
            (extension) =>
                filePath.endsWith(extension)
        )
    ) {
        return false;
    }

    return isSafeProjectFilePath(filePath);
}

function isSafePythonCommand(command) {
    const args = extractCommandArguments(
        command,
        /^python3\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))$/
    );

    if (!args || args.length !== 1) {
        return false;
    }

    const filePath = args[0];

    return (
        filePath.endsWith(".py") &&
        isSafeProjectFilePath(filePath)
    );
}

function isSafeTypeScriptCommand(command) {
    const args = extractCommandArguments(
        command,
        /^node\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))$/
    );

    if (!args || args.length !== 1) {
        return false;
    }

    return (
        args[0].endsWith(".js") &&
        isSafeProjectFilePath(args[0])
    );
}

function isSafeJavaBuildCommand(command) {
    const prefix = "javac ";

    if (!command.startsWith(prefix)) {
        return false;
    }

    const remainder = command.slice(prefix.length).trim();

    if (!remainder) {
        return false;
    }

    const files = remainder.split(/\s+/);

    if (!isSafeFileList(files)) {
        return false;
    }

    return files.every(
        (filePath) =>
            filePath.endsWith(".java")
    );
}

function isSafeJavaRunCommand(command) {
    const match =
        command.match(
            /^java\s+(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][A-Za-z0-9_.$]*))$/
        );

    if (!match) {
        return false;
    }

    const className =
        match[1] ??
        match[2] ??
        match[3];

    if (!className) {
        return false;
    }

    return /^[A-Za-z_$][A-Za-z0-9_.$]*$/.test(
        className
    );
}

function isSafeCBuildCommand(command) {
    const match =
        command.match(
            /^cc\s+(.+)\s+-o\s+([^\s]+)$/
        );

    if (!match) {
        return false;
    }

    const sourcePart = match[1];
    const outputPath = match[2];

    const files =
        sourcePart
            .trim()
            .split(/\s+/);

    if (
        !isSafeFileList(files) ||
        !isSafeOutputPath(outputPath)
    ) {
        return false;
    }

    return files.every(
        (filePath) =>
            filePath.endsWith(".c")
    );
}

function isSafeCppBuildCommand(command) {
    const match =
        command.match(
            /^c\+\+\s+(.+)\s+-o\s+([^\s]+)$/
        );

    if (!match) {
        return false;
    }

    const sourcePart = match[1];
    const outputPath = match[2];

    const files =
        sourcePart
            .trim()
            .split(/\s+/);

    if (
        !isSafeFileList(files) ||
        !isSafeOutputPath(outputPath)
    ) {
        return false;
    }

    return files.every(
        (filePath) =>
            filePath.endsWith(".cpp") ||
            filePath.endsWith(".cc") ||
            filePath.endsWith(".cxx")
    );
}

function isSafeExecutableRunCommand(command, executableName) {
    if (!command.startsWith(executableName)) {
        return false;
    }

    const remainder =
        command
            .slice(executableName.length)
            .trim();

    if (!remainder) {
        return false;
    }

    return (
        !remainder.includes(" ") &&
        isSafeProjectFilePath(remainder)
    );
}

function isSafeGoCommand(command) {
    const match =
        command.match(
            /^go\s+run\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))$/
        );

    if (!match) {
        return false;
    }

    const filePath =
        match[1] ??
        match[2] ??
        match[3];

    return (
        filePath.endsWith(".go") &&
        isSafeProjectFilePath(filePath)
    );
}

function isSafeRustBuildCommand(command) {
    const match =
        command.match(
            /^rustc\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))\s+-o\s+([^\s]+)$/
        );

    if (!match) {
        return false;
    }

    const sourceFile =
        match[1] ??
        match[2] ??
        match[3];

    const outputPath = match[4];

    return (
        sourceFile.endsWith(".rs") &&
        isSafeProjectFilePath(sourceFile) &&
        isSafeOutputPath(outputPath)
    );
}

function isSafeKotlinBuildCommand(command) {
    const match =
        command.match(
            /^kotlinc\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))\s+-include-runtime\s+-d\s+([^\s]+)$/
        );

    if (!match) {
        return false;
    }

    const sourceFile =
        match[1] ??
        match[2] ??
        match[3];

    const outputPath = match[4];

    return (
        sourceFile.endsWith(".kt") ||
        sourceFile.endsWith(".kts")
    )
        ? (
            isSafeProjectFilePath(sourceFile) &&
            isSafeOutputPath(outputPath)
        )
        : false;
}

function isSafeJarRunCommand(command) {
    const match =
        command.match(
            /^java\s+-jar\s+([^\s]+)$/
        );

    if (!match) {
        return false;
    }

    return isSafeProjectFilePath(match[1]);
}

function isSafeDotnetBuildCommand(command) {
    return command === "dotnet build";
}

function isSafeDotnetRunCommand(command) {
    return command === "dotnet run --no-build";
}

function isSafeSwiftCommand(command) {
    const match =
        command.match(
            /^swift\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))$/
        );

    if (!match) {
        return false;
    }

    const filePath =
        match[1] ??
        match[2] ??
        match[3];

    return (
        filePath.endsWith(".swift") &&
        isSafeProjectFilePath(filePath)
    );
}

function isSafePhpCommand(command) {
    const match =
        command.match(
            /^php\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))$/
        );

    if (!match) {
        return false;
    }

    const filePath =
        match[1] ??
        match[2] ??
        match[3];

    return (
        filePath.endsWith(".php") &&
        isSafeProjectFilePath(filePath)
    );
}

function isSafeRubyCommand(command) {
    const match =
        command.match(
            /^ruby\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))$/
        );

    if (!match) {
        return false;
    }

    const filePath =
        match[1] ??
        match[2] ??
        match[3];

    return (
        filePath.endsWith(".rb") &&
        isSafeProjectFilePath(filePath)
    );
}

function isSafeCSharpCommand(command) {
    return (
        command === "dotnet build" ||
        command === "dotnet run --no-build"
    );
}

function isAllowedDynamicCommand(command) {
    return (
        isSafeNodeCommand(command) ||
        isSafePythonCommand(command) ||
        isSafeTypeScriptCommand(command) ||
        isSafeJavaBuildCommand(command) ||
        isSafeJavaRunCommand(command) ||
        isSafeCBuildCommand(command) ||
        isSafeCppBuildCommand(command) ||
        isSafeGoCommand(command) ||
        isSafeRustBuildCommand(command) ||
        isSafeKotlinBuildCommand(command) ||
        isSafeJarRunCommand(command) ||
        isSafeDotnetBuildCommand(command) ||
        isSafeDotnetRunCommand(command) ||
        isSafeCSharpCommand(command) ||
        isSafeSwiftCommand(command) ||
        isSafePhpCommand(command) ||
        isSafeRubyCommand(command)
    );
}

export function validateSandboxCommand(command) {
    if (typeof command !== "string") {
        const error = new Error(
            "Sandbox command must be a string"
        );

        error.code =
            "INVALID_SANDBOX_COMMAND";

        throw error;
    }

    const normalizedCommand =
        command.trim();

    if (!normalizedCommand) {
        const error = new Error(
            "Sandbox command cannot be empty"
        );

        error.code =
            "EMPTY_SANDBOX_COMMAND";

        throw error;
    }

    const isExplicitlyAllowed =
        ALLOWED_COMMANDS.has(
            normalizedCommand
        );

    if (
        !isExplicitlyAllowed &&
        !isAllowedDynamicCommand(
            normalizedCommand
        )
    ) {
        const error = new Error(
            `Command is not allowed in the sandbox: ${normalizedCommand}`
        );

        error.code =
            "SANDBOX_COMMAND_NOT_ALLOWED";

        throw error;
    }

    return normalizedCommand;
}

export function getSandboxLimits({
    timeoutMs =
        DEFAULT_TIMEOUT_MS,

    maxOutputBytes =
        MAX_OUTPUT_BYTES
} = {}) {
    if (
        !Number.isInteger(timeoutMs) ||
        timeoutMs <= 0
    ) {
        const error = new Error(
            "Sandbox timeout must be a positive integer"
        );

        error.code =
            "INVALID_SANDBOX_TIMEOUT";

        throw error;
    }

    if (
        timeoutMs >
        MAX_TIMEOUT_MS
    ) {
        const error = new Error(
            `Sandbox timeout cannot exceed ${MAX_TIMEOUT_MS}ms`
        );

        error.code =
            "SANDBOX_TIMEOUT_TOO_LARGE";

        throw error;
    }

    if (
        !Number.isInteger(maxOutputBytes) ||
        maxOutputBytes <= 0
    ) {
        const error = new Error(
            "Sandbox max output must be a positive integer"
        );

        error.code =
            "INVALID_SANDBOX_OUTPUT_LIMIT";

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

        "node <project-relative-file>.js",
        "node <project-relative-file>.mjs",
        "node <project-relative-file>.cjs",
        "node <project-relative-file>.jsx",

        "python3 <project-relative-file>.py",

        "javac <project-relative-file>.java",
        "java <project-class-name>",

        "cc <project-relative-files>.c -o <output>",
        "c++ <project-relative-files>.cpp -o <output>",

        "dotnet build",
        "dotnet run --no-build",

        "go run <project-relative-file>.go",

        "rustc <project-relative-file>.rs -o <output>",
        "kotlinc <project-relative-file>.kt -include-runtime -d <output>",
        "java -jar <project-relative-file>.jar",

        "swift <project-relative-file>.swift",
        "php <project-relative-file>.php",
        "ruby <project-relative-file>.rb"
    ];
}