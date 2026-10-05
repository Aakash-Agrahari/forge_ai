import { executeInSandboxSession } from "./src/sandbox/sandboxSessionService.js";

const projectId = "cmtlhdwfm00050s934f42n6mb";

const result = await executeInSandboxSession({
    projectId,

    steps: [
        {
            name: "compile-java",
            command:
                'javac "addjava.java" "src/Calculator.java" "src/CalculatorRepair.java"'
        },
        {
            name: "run-java",
            command: "java addjava"
        }
    ]
});

console.log(
    JSON.stringify(result, null, 2)
);