import prisma from "../config/prisma.js";

export async function createProject({
    userId,
    name,
    description
}) {
    return prisma.project.create({
        data: {
            name,
            description,
            userId
        },
        select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function getUserProjects(userId) {
    return prisma.project.findMany({
        where: {
            userId
        },
        orderBy: {
            updatedAt: "desc"
        },
        select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function getProjectById({
    projectId,
    userId
}) {
    return prisma.project.findFirst({
        where: {
            id: projectId,
            userId
        },
        select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function updateProject({
    projectId,
    userId,
    data
}) {
    const existingProject = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId
        }
    });

    if (!existingProject) {
        return null;
    }

    return prisma.project.update({
        where: {
            id: projectId
        },
        data,
        select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function deleteProject({
    projectId,
    userId
}) {
    const existingProject = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId
        }
    });

    if (!existingProject) {
        return null;
    }

    await prisma.project.delete({
        where: {
            id: projectId
        }
    });

    return true;
}