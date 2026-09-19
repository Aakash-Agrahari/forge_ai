import { registerAgentTools } from "./tools/index.js";
import { runAgent } from "./agentOrchestrator.js";
import { discoverAllModels } from "../llm/discoveryManager.js";

registerAgentTools();

console.log("Starting model discovery...");

const discoveryResults =
    await discoverAllModels();

console.log(
    `Model discovery completed: ${discoveryResults.length} providers checked.`
);

console.log("Starting agent test...");

const result = await runAgent({
    runId: "test-run-001",

    projectId:
        "cmtlhdwfm00050s934f42n6mb",

    conversationId:
        "test-conversation-001",

    messages: [
        {
            role: "user",
            content:
                "Read the contents of src/App.jsx using the read_file tool and tell me what this file does."
        }
    ]
});

console.log(
    JSON.stringify(
        result,
        null,
        2
    )
);