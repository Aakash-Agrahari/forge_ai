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

for (const message of messages) {
    const argumentsValue = message.toolArguments;

    if (
        argumentsValue?.path === "src/hello.py" ||
        JSON.stringify(argumentsValue)?.includes("hello.py") ||
        message.content?.includes("hello.py") ||
        JSON.stringify(message.toolResult)?.includes("hello.py")
    ) {
        console.log("\n==============================");
        console.log("MATCHING CREATE_FILE MESSAGE");
        console.log("==============================");
        console.log(JSON.stringify(message, null, 2));
    }
}

await prisma.$disconnect();
