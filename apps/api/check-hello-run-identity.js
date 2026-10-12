import prisma from "./src/config/prisma.js";

const runIds = [
    "cmv3g16580000vs93pegdshl5",
    "cmv3opgcl00005893lfxhmkff"
];

for (const runId of runIds) {
    const run = await prisma.agentRun.findUnique({
        where: { id: runId },
        select: {
            id: true,
            conversationId: true,
            status: true,
            phase: true,
            iteration: true,
            toolCount: true,
            provider: true,
            model: true,
            error: true,
            startedAt: true,
            completedAt: true
        }
    });

    console.log("\n==============================");
    console.log("RUN:", runId);
    console.log("==============================");
    console.log(JSON.stringify(run, null, 2));
}

await prisma.$disconnect();
