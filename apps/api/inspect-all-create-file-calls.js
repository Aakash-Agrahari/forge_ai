import prisma from "./src/config/prisma.js";

const conversationId = "cmv16dboq000ous93oj07m33x";

const messages = await prisma.message.findMany({
    where: {
        conversationId,
        toolName: "create_file"
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

console.log("TOTAL CREATE_FILE MESSAGES:", messages.length);

for (const message of messages) {
    console.log("\n==============================");
    console.log("MESSAGE");
    console.log("==============================");

    console.log("ID:", message.id);
    console.log("ROLE:", message.role);
    console.log("TOOL CALL ID:", message.toolCallId);
    console.log("CREATED:", message.createdAt);

    console.log("\nTOOL ARGUMENTS:");
    console.log(JSON.stringify(message.toolArguments, null, 2));

    console.log("\nTOOL RESULT:");
    console.log(JSON.stringify(message.toolResult, null, 2));

    console.log("\nCONTENT:");
    console.log(message.content);
}

await prisma.$disconnect();
