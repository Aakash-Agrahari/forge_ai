import prisma from "./src/config/prisma.js";

const conversationId = "cmv16dboq000ous93oj07m33x";

const messages = await prisma.message.findMany({
    where: {
        conversationId,
        toolName: "create_file"
    },
    orderBy: {
        createdAt: "desc"
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

console.log(JSON.stringify(messages, null, 2));

await prisma.$disconnect();
