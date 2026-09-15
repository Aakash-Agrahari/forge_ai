import { registerAgentTools } from "./tools/index.js";
import { runAgent } from "./agentOrchestrator.js";

const projectId =
    "cmtlhdwfm00050s934f42n6mb";

const conversationId =
    "test-conversation";

const runId =
    "test-run";

registerAgentTools();

const result =
    await runAgent({
        runId,
        projectId,
        conversationId,

        messages: [
            {
                role: "user",
                content:
                    "What files are in my project?"
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