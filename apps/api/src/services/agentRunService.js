import prisma from "../config/prisma.js";

const RUN_SELECT = {
    id: true,
    conversationId: true,
    status: true,
    phase: true,
    provider: true,
    model: true,
    iteration: true,
    toolCount: true,
    currentTool: true,
    startedAt: true,
    lastHeartbeatAt: true,
    completedAt: true,
    error: true
};

const ACTIVE_RUN_STATUSES = ["queued", "running"];

export async function createAgentRun({
    conversationId,
    provider = null,
    model = null
}) {
    const activeRun = await prisma.agentRun.findFirst({
        where: {
            conversationId,
            status: {
                in: ACTIVE_RUN_STATUSES
            }
        },
        select: {
            id: true,
            status: true,
            phase: true
        }
    });

    if (activeRun) {
        const error = new Error(
            "An agent run is already active for this conversation."
        );

        error.code = "AGENT_RUN_ALREADY_ACTIVE";
        error.runId = activeRun.id;

        throw error;
    }

    return prisma.agentRun.create({
        data: {
            conversationId,
            status: "queued",
            phase: "queued",
            provider,
            model,
            iteration: 0,
            toolCount: 0,
            currentTool: null,
            lastHeartbeatAt: new Date()
        },
        select: RUN_SELECT
    });
}

export async function getAgentRun(runId) {
    return prisma.agentRun.findUnique({
        where: {
            id: runId
        },
        select: {
            id: true,
            conversationId: true,
            status: true,
            phase: true,
            provider: true,
            model: true,
            iteration: true,
            toolCount: true,
            currentTool: true,
            startedAt: true,
            lastHeartbeatAt: true,
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
        select: RUN_SELECT
    });
}

export async function updateAgentRun(runId, data) {
    return prisma.agentRun.update({
        where: {
            id: runId
        },
        data,
        select: RUN_SELECT
    });
}

export async function heartbeatAgentRun(runId, data = {}) {
    return prisma.agentRun.update({
        where: {
            id: runId
        },
        data: {
            ...data,
            lastHeartbeatAt: new Date()
        },
        select: RUN_SELECT
    });
}

export async function updateAgentRunPhase(
    runId,
    phase,
    {
        message = null,
        metadata = null,
        currentTool = undefined
    } = {}
) {
    const run = await prisma.agentRun.update({
        where: {
            id: runId
        },
        data: {
            phase,
            ...(currentTool !== undefined ? { currentTool } : {}),
            lastHeartbeatAt: new Date()
        },
        select: RUN_SELECT
    });

    await createAgentRunEvent({
        runId,
        type: "phase_changed",
        message,
        metadata: {
            phase,
            ...(metadata ?? {})
        }
    });

    return run;
}

export async function createAgentRunEvent({
    runId,
    type,
    message = null,
    metadata = null
}) {
    return prisma.agentRunEvent.create({
        data: {
            runId,
            type,
            message,
            metadata
        }
    });
}

export async function getAgentRunEvents(runId) {
    return prisma.agentRunEvent.findMany({
        where: {
            runId
        },
        orderBy: {
            createdAt: "asc"
        }
    });
}

export async function cancelAgentRun(runId) {
    const run = await prisma.agentRun.findUnique({
        where: {
            id: runId
        },
        select: {
            id: true,
            status: true
        }
    });

    if (!run) {
        return null;
    }

    if (!ACTIVE_RUN_STATUSES.includes(run.status)) {
        return prisma.agentRun.findUnique({
            where: {
                id: runId
            },
            select: RUN_SELECT
        });
    }

    const updatedRun = await prisma.agentRun.update({
        where: {
            id: runId
        },
        data: {
            status: "cancel_requested",
            phase: "cancelling",
            lastHeartbeatAt: new Date()
        },
        select: RUN_SELECT
    });

    await createAgentRunEvent({
        runId,
        type: "cancel_requested",
        message: "Agent run cancellation requested."
    });

    return updatedRun;
}

export async function isAgentRunCancellationRequested(runId) {
    const run = await prisma.agentRun.findUnique({
        where: {
            id: runId
        },
        select: {
            status: true
        }
    });

    if (!run) {
        return false;
    }

    return run.status === "cancel_requested";
}