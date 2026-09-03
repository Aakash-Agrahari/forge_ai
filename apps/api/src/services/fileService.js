import prisma from "../config/prisma.js";

export async function createProjectFile({
    projectId,
    path,
    content
}) {
    return prisma.projectFile.create({
        data: {
            projectId,
            path,
            content
        },
        select: {
            id: true,
            projectId: true,
            path: true,
            content: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function getProjectFiles(projectId) {
    return prisma.projectFile.findMany({
        where: {
            projectId
        },
        orderBy: {
            path: "asc"
        },
        select: {
            id: true,
            projectId: true,
            path: true,
            content: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function getProjectFile({
    projectId,
    fileId
}) {
    return prisma.projectFile.findFirst({
        where: {
            id: fileId,
            projectId
        },
        select: {
            id: true,
            projectId: true,
            path: true,
            content: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function updateProjectFile({
    projectId,
    fileId,
    content
}) {
    const existingFile = await prisma.projectFile.findFirst({
        where: {
            id: fileId,
            projectId
        }
    });

    if (!existingFile) {
        return null;
    }

    return prisma.projectFile.update({
        where: {
            id: fileId
        },
        data: {
            content
        },
        select: {
            id: true,
            projectId: true,
            path: true,
            content: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function deleteProjectFile({
    projectId,
    fileId
}) {
    const existingFile = await prisma.projectFile.findFirst({
        where: {
            id: fileId,
            projectId
        }
    });

    if (!existingFile) {
        return false;
    }

    await prisma.projectFile.delete({
        where: {
            id: fileId
        }
    });

    return true;
}