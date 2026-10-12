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
        content: true,
        createdAt: true
    }
});

console.log(JSON.stringify(messages, null, 2));

await prisma.$disconnect();
