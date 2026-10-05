import { executeInSandboxSession } from "./src/sandbox/sandboxSessionService.js";

const projectId = "cmtlhdwfm00050s934f42n6mb";

const result = await executeInSandboxSession({
    projectId,

    steps: [
        {
            name: "javascript",
            command: "node hello.js"
        }
    ]
});

console.log(
    JSON.stringify(result, null, 2)
);