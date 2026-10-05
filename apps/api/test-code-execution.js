import {
    executeCode
} from "./src/execution/codeExecutionService.js";

const projectId =
    "cmtlhdwfm00050s934f42n6mb";

console.log(
    "\n=== JavaScript execution ==="
);

try {
    const javascriptResult =
        await executeCode({
            projectId,
            filePath: "hello.js"
        });

    console.log(
        JSON.stringify(
            javascriptResult,
            null,
            2
        )
    );
} catch (error) {
    console.error(
        "JavaScript execution error:",
        error.message
    );
}

console.log(
    "\n=== Java execution ==="
);

try {
    const javaResult =
        await executeCode({
            projectId,
            filePath: "addjava.java"
        });

    console.log(
        JSON.stringify(
            javaResult,
            null,
            2
        )
    );
} catch (error) {
    console.error(
        "Java execution error:",
        error.message
    );
}