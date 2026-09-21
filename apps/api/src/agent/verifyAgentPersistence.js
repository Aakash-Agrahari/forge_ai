import prisma from "../config/prisma.js";

const CONVERSATION_ID = "cmub9lpur0000ew93en950kcv";
const RUN_ID = "cmub9lq770001ew932f14zdc9";

async function main() {
    console.log("\n========================================");
    console.log("ForgeAI Agent Persistence Verification");
    console.log("========================================\n");

    console.log("1. Checking conversation...");

    const conversation = await prisma.conversation.findUnique({
        where: {
            id: CONVERSATION_ID
        },
        select: {
            id: true,
            projectId: true,
            title: true,
            createdAt: true,
            updatedAt: true
        }
    });

    if (!conversation) {
        throw new Error(
            `Conversation not found: ${CONVERSATION_ID}`
        );
    }

    console.log("✓ Conversation found");
    console.log(conversation);

    console.log("\n2. Checking persisted messages...");

    const messages = await prisma.message.findMany({
        where: {
            conversationId: CONVERSATION_ID
        },
        orderBy: {
            createdAt: "asc"
        },
        select: {
            id: true,
            role: true,
            content: true,
            toolCallId: true,
            toolName: true,
            toolArguments: true,
            toolResult: true,
            createdAt: true
        }
    });

    console.log(`✓ Messages found: ${messages.length}`);

    for (const [index, message] of messages.entries()) {
        console.log(`\n--- Message ${index + 1} ---`);
        console.log(`Role: ${message.role}`);

        if (message.toolName) {
            console.log(`Tool: ${message.toolName}`);
        }

        if (message.toolCallId) {
            console.log(`Tool Call ID: ${message.toolCallId}`);
        }

        console.log(
            `Content: ${message.content || "(empty)"}`
        );

        if (message.toolArguments) {
            console.log(
                "Tool Arguments:",
                JSON.stringify(
                    message.toolArguments,
                    null,
                    2
                )
            );
        }

        if (message.toolResult) {
            console.log(
                "Tool Result:",
                JSON.stringify(
                    message.toolResult,
                    null,
                    2
                )
            );
        }
    }

    console.log("\n3. Checking AgentRun...");

    const run = await prisma.agentRun.findUnique({
        where: {
            id: RUN_ID
        },
        select: {
            id: true,
            conversationId: true,
            status: true,
            provider: true,
            model: true,
            startedAt: true,
            completedAt: true,
            error: true
        }
    });

    if (!run) {
        throw new Error(
            `AgentRun not found: ${RUN_ID}`
        );
    }

    console.log("✓ AgentRun found");
    console.log(run);

    console.log("\n4. Running integrity checks...");

    const checks = {
        conversationExists: Boolean(conversation),

        messagesExist: messages.length > 0,

        userMessagePersisted:
            messages.some(
                (message) =>
                    message.role === "user"
            ),

        assistantToolCallPersisted:
            messages.some(
                (message) =>
                    message.role === "assistant" &&
                    message.toolName !== null
            ),

        toolResultPersisted:
            messages.some(
                (message) =>
                    message.role === "tool" &&
                    message.toolResult !== null
            ),

        finalAssistantMessagePersisted:
            messages.some(
                (message) =>
                    message.role === "assistant" &&
                    message.toolName === null &&
                    message.content
            ),

        agentRunCompleted:
            run.status === "completed",

        providerPersisted:
            Boolean(run.provider),

        modelPersisted:
            Boolean(run.model),

        noAgentError:
            run.error === null
    };

    console.log("\nIntegrity checks:");

    for (const [name, passed] of Object.entries(checks)) {
        console.log(
            `${passed ? "✓" : "✗"} ${name}`
        );
    }

    const allPassed = Object.values(checks)
        .every(Boolean);

    console.log("\n========================================");

    if (allPassed) {
        console.log(
            "✓ ALL PERSISTENCE CHECKS PASSED"
        );
    } else {
        console.log(
            "✗ SOME PERSISTENCE CHECKS FAILED"
        );
    }

    console.log("========================================\n");

    if (!allPassed) {
        process.exitCode = 1;
    }
}

main()
    .catch((error) => {
        console.error(
            "\nPersistence verification failed:"
        );
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });