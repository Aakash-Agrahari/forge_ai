import {
    getExecutionStrategy,
    createRunCommand,
    getBuildCommand,
    getSupportedExecutionLanguages
} from "./src/execution/executionStrategy.js";

console.log(
    "Supported languages:"
);

console.log(
    getSupportedExecutionLanguages()
);

console.log(
    "\nJavaScript strategy:"
);

console.log(
    getExecutionStrategy("javascript")
);

console.log(
    "\nJavaScript run command:"
);

console.log(
    createRunCommand({
        language: "javascript",
        filePath: "src/app.js"
    })
);

console.log(
    "\nPython run command:"
);

console.log(
    createRunCommand({
        language: "python",
        filePath: "src/app.py"
    })
);

console.log(
    "\nJava strategy:"
);

console.log(
    getExecutionStrategy("java")
);

console.log(
    "\nJava build command:"
);

console.log(
    getBuildCommand("java")
);

console.log(
    "\nC++ strategy:"
);

console.log(
    getExecutionStrategy("cpp")
);

console.log(
    "\nGo strategy:"
);

console.log(
    getExecutionStrategy("go")
);