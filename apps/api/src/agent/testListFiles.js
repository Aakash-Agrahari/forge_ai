import { registerAgentTools } from "./tools/index.js";
import { executeTool } from "./toolRegistery.js";

console.log("1. Test script started");

const projectId = "cmtlhdwfm00050s934f42n6mb";

try {
    console.log("2. Registering agent tools");

    registerAgentTools();

    console.log("3. Tools registered");
    console.log("4. Executing list_files");

    const result = await executeTool(
        "list_files",
        {},
        {
            projectId
        }
    );

    console.log("5. Tool execution completed");

    console.log(
        "RESULT:",
        JSON.stringify(result, null, 2)
    );
} catch (error) {
    console.error("TEST FAILED:");
    console.error(error);
}