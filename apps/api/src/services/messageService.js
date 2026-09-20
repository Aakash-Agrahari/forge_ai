import prisma from "../config/prisma.js";

export async function createMessage({
    conversationId,
    role,
    content = "",
    toolCallId = null,
    toolName = null,
    toolArguments = null,
    toolResult = null
}) {
    return prisma.message.create({
        data: {
            conversationId,
            role,
            content,
            toolCallId,
            toolName,
            toolArguments,
            toolResult
        },
        select: {
            id: true,
            conversationId: true,
            role: true,
            content: true,
            toolCallId: true,
            toolName: true,
            toolArguments: true,
            toolResult: true,
            createdAt: true
        }
    });
}

export async function getConversationMessages(
    conversationId
) {
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
            toolCallId: true,
            toolName: true,
            toolArguments: true,
            toolResult: true,
            createdAt: true
        }
    });
}