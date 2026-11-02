import prisma from "../config/prisma.js";
import {getOrCreateDocument} from "../collaboration/yjsDocumentManager.js";

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
     * Keep the in-memory Yjs document aligned
     * with the persisted file.
     */
    const document =
        getOrCreateDocument(
            projectId,
            fileId
        );

    const yText =
        document.getText("content");

    const currentYjsContent =
        yText.toString();

    if (currentYjsContent !== content) {
        document.transact(
            () => {
                if (yText.length > 0) {
                    yText.delete(
                        0,
                        yText.length
                    );
                }

                if (content) {
                    yText.insert(
                        0,
                        content
                    );
                }
            },
            "database"
        );
    }

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

    return true;
}

export async function upsertProjectFile({
    projectId, path, content
}) {
    return prisma.projectFile.upsert({
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
}