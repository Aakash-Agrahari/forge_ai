import prisma from "./src/config/prisma.js";

const runId = "cmv3opgcl00005893lfxhmkff";

const events = await prisma.agentRunEvent.findMany({
    where: {
        runId
    },
    orderBy: {
        createdAt: "asc"
    }
});

console.log(JSON.stringify(events, null, 2));

await prisma.$disconnect();
