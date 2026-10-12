import prisma from "./src/config/prisma.js";

const conversationId = "cmv16dboq000ous93oj07m33x";

const messages = await prisma.message.findMany({
    where: {
        conversationId,
        role: "user"
    },
    orderBy: {
        createdAt: "asc"
    },
    select: {
        id: true,
        role: true,
        content: true,
        createdAt: true
    }
});

console.log("TOTAL USER MESSAGES:", messages.length);

for (const message of messages) {
    if (
        message.content?.toLowerCase().includes("hello.py") ||
        message.content?.toLowerCase().includes("hello forgeai") ||
        message.content?.toLowerCase().includes("python file")
    ) {
        console.log("\n==============================");
        console.log("MATCHING USER MESSAGE");
        console.log("==============================");
        console.log(JSON.stringify(message, null, 2));
    }
}

await prisma.$disconnect();
