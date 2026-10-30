import prisma from "../config/prisma.js";
import {getOrCreateDocument} from "./yjsDocumentManager.js";

export async function loadFileIntoYjs(projectId, fileId) {
    const file = await prisma.projectFile.findFirst({
        where: {
            id: fileId,
            projectId
        },
        select: {
            id: true,
            content: true
        }
    });

    if (!file) {
        return null;
    }

    const document = getOrCreateDocument(projectId, fileId);
    const content = document.getText("content");

    // Only initialize an empty Yjs document.
    // Never overwrite an already synchronized document.
    if (content.length === 0 && file.content) {
        document.transact(() => {
            content.insert(0, file.content);
        });
    }

    return {
        file,
        document
    };
}