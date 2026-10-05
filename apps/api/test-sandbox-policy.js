import { validateSandboxCommand } from "./src/sandbox/sandboxPolicy.js";

const commands = [
    'javac "addjava.java" "src/Calculator.java" "src/CalculatorRepair.java"',
    "java addjava",
    "node hello.js",
    "python src/test.py",
    "rm -rf *",
    "node -e \"console.log('dangerous')\""
];

for (const command of commands) {
    try {
        const result = validateSandboxCommand(command);

        console.log("ALLOWED:", command);
        console.log("NORMALIZED:", result);
        console.log();
    } catch (error) {
        console.log("BLOCKED:", command);
        console.log("CODE:", error.code);
        console.log();
    }
}