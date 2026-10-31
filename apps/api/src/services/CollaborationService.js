import crypto from "crypto";
import prisma from "../config/prisma.js";

function generateShareToken() {
    return crypto.randomBytes(32).toString("hex");
}

export async function createOrGetCollaborationRoom({
    projectId,
    ownerId
}) {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId: ownerId
        },
        select: {
            id: true
        }
    });

    if (!project) {
        return null;
    }

    const existingRoom =
        await prisma.collaborationRoom.findUnique({
            where: {
                projectId
            }
        });

    if (existingRoom) {
        if (!existingRoom.isActive) {
            return prisma.collaborationRoom.update({
                where: {
                    id: existingRoom.id
                },
                data: {
                    isActive: true
                },
                select: {
                    id: true,
                    projectId: true,
                    shareToken: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
        }

        return existingRoom;
    }

    return prisma.collaborationRoom.create({
        data: {
            projectId,
            ownerId,
            shareToken: generateShareToken()
        },
        select: {
            id: true,
            projectId: true,
            shareToken: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function getCollaborationRoomByToken(
    shareToken
) {
    return prisma.collaborationRoom.findFirst({
        where: {
            shareToken,
            isActive: true
        },
        select: {
            id: true,
            projectId: true,
            ownerId: true,
            shareToken: true,
            isActive: true,
            project: {
                select: {
                    id: true,
                    name: true,
                    description: true
                }
            }
        }
    });
}

export async function deactivateCollaborationRoom({
    projectId,
    ownerId
}) {
    const room = await prisma.collaborationRoom.findFirst({
        where: {
            projectId,
            ownerId
        }
    });

    if (!room) {
        return null;
    }

    return prisma.collaborationRoom.update({
        where: {
            id: room.id
        },
        data: {
            isActive: false
        },
        select: {
            id: true,
            projectId: true,
            isActive: true
        }
    });
}

export async function getCollaborationAccess({
    projectId,
    shareToken,
}) {
    if (!projectId || !shareToken) {
        return null;
    }

    const room = await prisma.collaborationRoom.findFirst({
        where: {
            projectId,
            shareToken,
            isActive: true,
        },
        select: {
            id: true,
            projectId: true,
            ownerId: true,
            shareToken: true,
            isActive: true,
        },
    });

    return room;
}