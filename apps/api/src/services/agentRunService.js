import prisma from "../config/prisma.js";

export async function createAgentRun({
    conversationId,
    provider = null,
    model = null
}) {
    return prisma.agentRun.create({
        data: {
            conversationId,
            status: "queued",
            provider,
            model
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
}

export async function getAgentRun({
    runId,
    conversationId
}) {
    return prisma.agentRun.findFirst({
        where: {
            id: runId,
            conversationId
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
}

export async function getConversationAgentRuns(conversationId) {
    return prisma.agentRun.findMany({
        where: {
            conversationId
        },
        orderBy: {
            startedAt: "desc"
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
}

export async function updateAgentRun({
    runId,
    conversationId,
    data
}) {
    const existingRun = await prisma.agentRun.findFirst({
        where: {
            id: runId,
            conversationId
        }
    });

    if (!existingRun) {
        return null;
    }

    return prisma.agentRun.update({
        where: {
            id: runId
        },
        data,
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
}