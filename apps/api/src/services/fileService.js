import prisma from "../config/prisma.js";
import {
    syncLiveDocumentFromDatabase,
    unloadFileFromYjs
} from "../collaboration/yjsFileService.js";

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
    const existingFile =
        await prisma.projectFile.findFirst({
            where: {
                id: fileId,
                projectId
            }
        });

    if (!existingFile) {
        return null;
    }

    const updatedFile =
        await prisma.projectFile.update({
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

    /*
     * Keep the live Yjs document aligned with the persisted file.
     *
     * Only the changed region is applied (minimal diff) and the change
     * is BROADCAST to every connected collaborator by the document's
     * update listener. Previously the document was rewritten on the
     * server only, which forked the server state from the clients'
     * state after every "Save" and made collaborators go out of sync.
     */
    syncLiveDocumentFromDatabase(
        projectId,
        fileId,
        content
    );

    return updatedFile;
}

export async function renameProjectFile({
    projectId,
    fileId,
    path
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
            path
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

    unloadFileFromYjs(projectId, fileId);

    return true;
}

export async function upsertProjectFile({
    projectId, path, content
}) {
    const file = await prisma.projectFile.upsert({
        where: {
            projectId_path: {
                projectId, path
            }
        },
        create: {
            projectId, path, content
        },
        update: {
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

    // AI-agent / archive writes must show up live for collaborators too.
    syncLiveDocumentFromDatabase(projectId, file.id, content);

    return file;
}