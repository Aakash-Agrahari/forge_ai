import prisma from "../lib/prisma.js";

export async function createProjectFolder({
    projectId,
    path
}) {
    return prisma.projectFolder.create({
        data: {
            projectId,
            path
        }
    });
}

export async function getProjectFolders(projectId) {
    return prisma.projectFolder.findMany({
        where: {
            projectId
        },
        orderBy: {
            path: "asc"
        }
    });
}

export async function getProjectFolder({
    projectId,
    folderId
}) {
    return prisma.projectFolder.findFirst({
        where: {
            id: folderId,
            projectId
        }
    });
}

export async function renameProjectFolder({
    projectId,
    folderId,
    path
}) {
    return prisma.projectFolder.updateMany({
        where: {
            id: folderId,
            projectId
        },
        data: {
            path
        }
    });
}

export async function deleteProjectFolder({
    projectId,
    folderId
}) {
    return prisma.projectFolder.deleteMany({
        where: {
            id: folderId,
            projectId
        }
    });
}