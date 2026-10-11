import { registerAgentTools } from "./src/agent/tools/index.js";
import { getTool } from "./src/agent/toolRegistery.js";
import { getProjectFiles } from "./src/services/fileService.js";

registerAgentTools();

const tool = getTool("create_file");

if (!tool) {
    throw new Error("create_file tool is not registered");
}

const projectId = "cmtlhdwfm00050s934f42n6mb";

const result = await tool.execute(
    {
        path: "src/agent-direct-test.py",
        content: "def hello():\n    return \"Hello from agent tool\"\n"
    },
    {
        projectId
    }
);

console.log("TOOL RESULT:");
console.log(JSON.stringify(result, null, 2));

const files = await getProjectFiles(projectId);

const created = files.find(
    (file) => file.path === "src/agent-direct-test.py"
);

console.log("\nDATABASE RESULT:");
console.log(JSON.stringify(created ?? null, null, 2));
