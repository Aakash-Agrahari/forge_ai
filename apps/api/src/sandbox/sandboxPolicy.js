const ALLOWED_COMMANDS = new Set([
    "npm test",
    "npm run build",
    "npm run lint",
    "git status",
    "node --test",

    // TypeScript
    "npx tsc --pretty false",

    // .NET
    "dotnet build",
    "dotnet run --no-build",

    // Kotlin
    "java -jar .forgeai-kotlin.jar",

    // Native / Rust executables
    "./.forgeai-c-program",
    "./.forgeai-cpp-program",
    "./.forgeai-rust-program"
]);

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const MAX_OUTPUT_BYTES = 1_000_000;

function extractQuotedOrUnquotedArgument(command, prefix) {
    if (!command.startsWith(prefix)) {
        return null;
    }

    const remainder = command.slice(prefix.length).trim();

    if (!remainder) {
        return null;
    }

    if (
        remainder.startsWith("\"") &&
        remainder.endsWith("\"")
    ) {
        return remainder.slice(1, -1);
    }

    if (
        remainder.startsWith("'") &&
        remainder.endsWith("'")
    ) {
        return remainder.slice(1, -1);
    }

    return remainder;
}

function isSafeProjectFilePath(filePath) {
    if (typeof filePath !== "string") {
        return false;
    }

    const value = filePath.trim();

    if (!value) {
        return false;
    }

    // Never allow command-line options.
    if (value.startsWith("-")) {
        return false;
    }

    // Never allow shell operators.
    const dangerousTokens = [
        "&&",
        "||",
        ";",
        "|",
        ">",
        "<",
        "$(",
        "`"
    ];

    for (const token of dangerousTokens) {
        if (value.includes(token)) {
            return false;
        }
    }

    // Reject absolute Unix paths.
    if (value.startsWith("/")) {
        return false;
    }

    // Reject Windows absolute paths.
    if (/^[a-zA-Z]:[\\/]/.test(value)) {
        return false;
    }

    // Reject UNC paths.
    if (value.startsWith("\\\\")) {
        return false;
    }

    // Reject path traversal.
    const normalized = value.replaceAll("\\", "/");
    const segments = normalized.split("/");

    if (segments.includes("..")) {
        return false;
    }

    return true;
}

function isSafeSourceExtension(filePath, extensions) {
    const normalized = filePath.toLowerCase();

    return extensions.some(
        extension => normalized.endsWith(extension)
    );
}

function isSafeNodeCommand(command) {
    const filePath = extractQuotedOrUnquotedArgument(
        command,
        "node "
    );

    if (!filePath) {
        return false;
    }

    if (!isSafeProjectFilePath(filePath)) {
        return false;
    }

    return isSafeSourceExtension(
        filePath,
        [".js", ".mjs", ".cjs", ".jsx"]
    );
}

function isSafePythonCommand(command) {
    const filePath = extractQuotedOrUnquotedArgument(
        command,
        "python3 "
    );

    if (!filePath) {
        return false;
    }

    if (!isSafeProjectFilePath(filePath)) {
        return false;
    }

    return filePath.toLowerCase().endsWith(".py");
}

function isSafeGoCommand(command) {
    const filePath = extractQuotedOrUnquotedArgument(
        command,
        "go run "
    );

    if (!filePath) {
        return false;
    }

    if (!isSafeProjectFilePath(filePath)) {
        return false;
    }

    return filePath.toLowerCase().endsWith(".go");
}

function isSafeSwiftCommand(command) {
    const filePath = extractQuotedOrUnquotedArgument(
        command,
        "swift "
    );

    if (!filePath) {
        return false;
    }

    if (!isSafeProjectFilePath(filePath)) {
        return false;
    }

    return filePath.toLowerCase().endsWith(".swift");
}

function isSafePhpCommand(command) {
    const filePath = extractQuotedOrUnquotedArgument(
        command,
        "php "
    );

    if (!filePath) {
        return false;
    }

    if (!isSafeProjectFilePath(filePath)) {
        return false;
    }

    return filePath.toLowerCase().endsWith(".php");
}

function isSafeRubyCommand(command) {
    const filePath = extractQuotedOrUnquotedArgument(
        command,
        "ruby "
    );

    if (!filePath) {
        return false;
    }

    if (!isSafeProjectFilePath(filePath)) {
        return false;
    }

    return filePath.toLowerCase().endsWith(".rb");
}

function isSafeJavaCommand(command) {
    if (!command.startsWith("java ")) {
        return false;
    }

    const simpleClassPattern =
        /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

    /*
     * Supported:
     *
     * java "MainClass"
     * java -cp ".forgeai-java-build" "com.example.MainClass"
     */

    const simpleMatch = command.match(
        /^java\s+"?([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)"?$/
    );

    if (simpleMatch) {
        return simpleClassPattern.test(simpleMatch[1]);
    }

    /*
     * Only allow ForgeAI's controlled Java build directory.
     *
     * This prevents arbitrary classpaths while allowing the
     * execution strategy used by ForgeAI.
     */
    const classpathMatch = command.match(
        /^java\s+-cp\s+"(\.forgeai-java-build)"\s+"([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*)"$/
    );

    if (!classpathMatch) {
        return false;
    }

    const classpath = classpathMatch[1];
    const className = classpathMatch[2];

    return (
        classpath === ".forgeai-java-build" &&
        simpleClassPattern.test(className)
    );
}


function isSafeJavaBuildCommand(command) {
    if (!command.startsWith("javac ")) {
        return false;
    }

    /*
     * ForgeAI Java build format:
     *
     * javac -d ".forgeai-java-build" "<file1.java>" "<file2.java>"
     *
     * Only this exact compiler option is allowed.
     */

    const match = command.match(
        /^javac\s+-d\s+"(\.forgeai-java-build)"\s+(.+)$/
    );

    if (!match) {
        return false;
    }

    const outputDirectory = match[1];
    const filesPart = match[2];

    if (outputDirectory !== ".forgeai-java-build") {
        return false;
    }

    /*
     * Extract quoted or unquoted source files.
     */
    const files = filesPart.match(
        /(?:"[^"]+"|'[^']+'|[^\s]+)/g
    );

    if (!files || files.length === 0) {
        return false;
    }

    return files.every(file => {
        const cleanFile = file
            .replace(/^"/, "")
            .replace(/"$/, "")
            .replace(/^'/, "")
            .replace(/'$/, "");

        return (
            isSafeProjectFilePath(cleanFile) &&
            cleanFile.toLowerCase().endsWith(".java")
        );
    });
}

function isSafeCBuildCommand(command) {
    if (!command.startsWith("cc ")) {
        return false;
    }

    const expectedSuffix = " -o .forgeai-c-program";

    if (!command.endsWith(expectedSuffix)) {
        return false;
    }

    const filesPart = command
        .slice("cc ".length)
        .slice(0, -expectedSuffix.length)
        .trim();

    if (!filesPart) {
        return false;
    }

    const files = filesPart.match(
        /(?:"[^"]+"|'[^']+'|[^\s]+)/
    );

    if (!files) {
        return false;
    }

    const allFiles = filesPart.match(
        /(?:"[^"]+"|'[^']+'|[^\s]+)/g
    );

    if (!allFiles || allFiles.length === 0) {
        return false;
    }

    return allFiles.every(file => {
        const cleanFile = file
            .replace(/^"/, "")
            .replace(/"$/, "")
            .replace(/^'/, "")
            .replace(/'$/, "");

        return (
            isSafeProjectFilePath(cleanFile) &&
            cleanFile.toLowerCase().endsWith(".c")
        );
    });
}

function isSafeCppBuildCommand(command) {
    if (!command.startsWith("c++ ")) {
        return false;
    }

    const expectedSuffix = " -o .forgeai-cpp-program";

    if (!command.endsWith(expectedSuffix)) {
        return false;
    }

    const filesPart = command
        .slice("c++ ".length)
        .slice(0, -expectedSuffix.length)
        .trim();

    if (!filesPart) {
        return false;
    }

    const files = filesPart.match(
        /(?:"[^"]+"|'[^']+'|[^\s]+)/g
    );

    if (!files || files.length === 0) {
        return false;
    }

    return files.every(file => {
        const cleanFile = file
            .replace(/^"/, "")
            .replace(/"$/, "")
            .replace(/^'/, "")
            .replace(/'$/, "");

        return (
            isSafeProjectFilePath(cleanFile) &&
            [".cpp", ".cc", ".cxx"].some(
                extension =>
                    cleanFile.toLowerCase().endsWith(extension)
            )
        );
    });
}

function isSafeRustBuildCommand(command) {
    if (!command.startsWith("rustc ")) {
        return false;
    }

    const expectedSuffix =
        " -o .forgeai-rust-program";

    if (!command.endsWith(expectedSuffix)) {
        return false;
    }

    const filePart = command
        .slice("rustc ".length)
        .slice(0, -expectedSuffix.length)
        .trim();

    const filePath = filePart
        .replace(/^"/, "")
        .replace(/"$/, "")
        .replace(/^'/, "")
        .replace(/'$/, "");

    return (
        isSafeProjectFilePath(filePath) &&
        filePath.toLowerCase().endsWith(".rs")
    );
}

function isSafeKotlinBuildCommand(command) {
    if (!command.startsWith("kotlinc ")) {
        return false;
    }

    const expectedSuffix =
        " -include-runtime -d .forgeai-kotlin.jar";

    if (!command.endsWith(expectedSuffix)) {
        return false;
    }

    const filePart = command
        .slice("kotlinc ".length)
        .slice(0, -expectedSuffix.length)
        .trim();

    const filePath = filePart
        .replace(/^"/, "")
        .replace(/"$/, "")
        .replace(/^'/, "")
        .replace(/'$/, "");

    return (
        isSafeProjectFilePath(filePath) &&
        [".kt", ".kts"].some(
            extension =>
                filePath.toLowerCase().endsWith(extension)
        )
    );
}

function isSafeSandboxExecutableCommand(command) {
    return (
        command === "./.forgeai-c-program" ||
        command === "./.forgeai-cpp-program" ||
        command === "./.forgeai-rust-program"
    );
}

function isSafeTypeScriptBuildCommand(command) {
    return command === "npx tsc --pretty false";
}

function isSafeDotnetCommand(command) {
    return (
        command === "dotnet build" ||
        command === "dotnet run --no-build"
    );
}

function isSafeKotlinRunCommand(command) {
    return command === "java -jar .forgeai-kotlin.jar";
}

export function validateSandboxCommand(command) {
    if (typeof command !== "string") {
        const error = new Error(
            "Sandbox command must be a string"
        );

        error.code = "SANDBOX_COMMAND_INVALID";

        throw error;
    }

    const normalizedCommand = command.trim();

    if (!normalizedCommand) {
        const error = new Error(
            "Sandbox command cannot be empty"
        );

        error.code = "SANDBOX_COMMAND_INVALID";

        throw error;
    }

    if (ALLOWED_COMMANDS.has(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeNodeCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafePythonCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeGoCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeSwiftCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafePhpCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeRubyCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeJavaCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeJavaBuildCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeCBuildCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeCppBuildCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeRustBuildCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeKotlinBuildCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeTypeScriptBuildCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeDotnetCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeKotlinRunCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    if (isSafeSandboxExecutableCommand(normalizedCommand)) {
        return normalizedCommand;
    }

    const error = new Error(
        `Sandbox command is not allowed: ${command}`
    );

    error.code = "SANDBOX_COMMAND_NOT_ALLOWED";

    throw error;
}

export function getSandboxLimits({
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputBytes = MAX_OUTPUT_BYTES
} = {}) {
    if (
        !Number.isInteger(timeoutMs) ||
        timeoutMs <= 0
    ) {
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

        error.code = "SANDBOX_TIMEOUT_EXCEEDED";

        throw error;
    }

    if (
        !Number.isInteger(maxOutputBytes) ||
        maxOutputBytes <= 0
    ) {
        const error = new Error(
            "Sandbox maxOutputBytes must be a positive integer"
        );

        error.code = "INVALID_SANDBOX_OUTPUT_LIMIT";

        throw error;
    }

    if (maxOutputBytes > MAX_OUTPUT_BYTES) {
        const error = new Error(
            `Sandbox output cannot exceed ${MAX_OUTPUT_BYTES} bytes`
        );

        error.code = "SANDBOX_OUTPUT_LIMIT_EXCEEDED";

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
        "node <safe-source-file>",
        "python3 <safe-python-file>",
        "go run <safe-go-file>",
        "swift <safe-swift-file>",
        "php <safe-php-file>",
        "ruby <safe-ruby-file>",
        "java <safe-class-name>",
        "java -cp .forgeai-java-build <safe-class-name>",
        "javac -d .forgeai-java-build <safe-java-files>",
        "cc <safe-c-files> -o .forgeai-c-program",
        "c++ <safe-cpp-files> -o .forgeai-cpp-program",
        "rustc <safe-rust-file> -o .forgeai-rust-program",
        "kotlinc <safe-kotlin-file> -include-runtime -d .forgeai-kotlin.jar"
    ];
}

export {
    DEFAULT_TIMEOUT_MS,
    MAX_TIMEOUT_MS,
    MAX_OUTPUT_BYTES
};