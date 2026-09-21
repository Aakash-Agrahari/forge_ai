import { registerAgentTools } from "./tools/index.js";
import { runAgent } from "./agentOrchestrator.js";

import { discoverAllModels } from "../llm/discoveryManager.js";

import {
    createConversation
} from "../services/conversationService.js";

import {
    createAgentRun
} from "../services/agentRunService.js";

const PROJECT_ID = "cmtlhdwfm00050s934f42n6mb";

async function main() {
    // --------------------------------------------------
    // 1. Register agent tools
    // --------------------------------------------------

    registerAgentTools();

    // --------------------------------------------------
    // 2. Discover available models
    // --------------------------------------------------

    console.log("Starting model discovery...");

    const discoveryResults =
        await discoverAllModels();

    console.log(
        `Model discovery completed: ${discoveryResults.length} providers checked.`
    );

    // --------------------------------------------------
    // 3. Create a real conversation
    // --------------------------------------------------

    console.log("Creating test conversation...");

    const conversation =
        await createConversation({
            projectId: PROJECT_ID,
            title: "Agent Persistence Test"
        });

    console.log(
        `Conversation created: ${conversation.id}`
    );

    // --------------------------------------------------
    // 4. Create a real AgentRun
    // --------------------------------------------------

    console.log("Creating agent run...");

    const run = await createAgentRun({
        conversationId: conversation.id
    });

    console.log(
        `Agent run created: ${run.id}`
    );

    // --------------------------------------------------
    // 5. Start agent
    // --------------------------------------------------

    console.log("Starting agent test...");

    const result = await runAgent({
        runId: run.id,
        projectId: PROJECT_ID,
        conversationId: conversation.id,

        messages: [
            {
                role: "user",
                content:
                    "Update src/App.jsx so that the App component displays a heading saying 'Hello from ForgeAI!' instead of 'Hello ForgeAI'. Use the write_file tool to make the change."
            }
        ]
    });

    // --------------------------------------------------
    // 6. Display result
    // --------------------------------------------------

    console.log(
        JSON.stringify(
            result,
            null,
            2
        )
    );
}

main().catch((error) => {
    console.error(
        "Agent test failed:"
    );

    console.error(error);

    process.exit(1);
});