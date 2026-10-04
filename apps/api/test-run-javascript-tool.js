import { registerAgentTools } from "./src/agent/tools/index.js";
import { executeTool } from "./src/agent/toolRegistery.js";

registerAgentTools();

const result = await executeTool(
    "run_javascript_test",
    {
        filePath: "ceb.js",
        functionName: "ceb",
        args: [[2, 7, 11, 15], 9],
        expectedResult: [0, 1]
    },
    {
        projectId: "cmtlhdwfm00050s934f42n6mb",
        conversationId: "manual-test",
        runId: "manual-test"
    }
);

console.log(
    JSON.stringify(result, null, 2)
);