import prisma from "../config/prisma.js";

import prisma from "../config/prisma.js";

export async function createConversation({
    projectId,
    title
}) {
    return prisma.conversation.create({
        data: {
            projectId,
            title
        },
        select: {
            id: true,
            projectId: true,
            title: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function getProjectConversations(projectId) {
    return prisma.conversation.findMany({
        where: {
            projectId
        },
        orderBy: {
            updatedAt: "desc"
        },
        select: {
            id: true,
            projectId: true,
            title: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function getConversation({
    conversationId,
    projectId
}) {
    return prisma.conversation.findFirst({
        where: {
            id: conversationId,
            projectId
        },
        select: {
            id: true,
            projectId: true,
            title: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function createMessage({
    conversationId,
    role,
    content
}) {
    return prisma.message.create({
        data: {
            conversationId,
            role,
            content
        },
        select: {
            id: true,
            conversationId: true,
            role: true,
            content: true,
            createdAt: true
        }
    });
}

export async function getConversationMessages(conversationId) {
    return prisma.message.findMany({
        where: {
            conversationId
        },
        orderBy: {
            createdAt: "asc"
        },
        select: {
            id: true,
            conversationId: true,
            role: true,
            content: true,
            createdAt: true
        }
    });
}