import prisma from "../config/prisma.js";

import {
    getOrCreateDocument,
    getDocument,
    deleteDocument
} from "./yjsDocumentManager.js";

import { replaceTextWithDiff } from "./yjsSync.js";

/*
 * Files whose Yjs document has already been seeded from PostgreSQL.
 *
 * The old implementation decided "is this document initialised?" by
 * checking `content.length === 0`. That is wrong: if collaborators
 * legitimately delete the whole file the document is empty again and
 * the next call re-inserted the old database content on the server
 * only (never broadcast), silently forking server and clients.
 */
const initializedDocuments = new Set();

// Concurrent loads of the same file share one database query.
const pendingLoads = new Map();

function getKey(projectId, fileId) {
    return `${projectId}:${fileId}`;
}

async function loadFromDatabase(projectId, fileId) {
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
    const yText = document.getText("content");

    /*
     * Seed once. PostgreSQL is the initial source; after that Yjs is
     * the live source of truth. The "init" origin keeps this from being
     * broadcast - clients get it through the sync handshake.
     */
    if (!initializedDocuments.has(getKey(projectId, fileId))) {
        if (yText.length === 0 && file.content) {
            document.transact(() => {
                yText.insert(0, file.content);
            }, "init");
        }

        initializedDocuments.add(getKey(projectId, fileId));
    }

    return { file, document };
}

export async function loadFileIntoYjs(projectId, fileId) {
    const key = getKey(projectId, fileId);

    // Fast path: no database round-trip for every keystroke.
    if (initializedDocuments.has(key)) {
        return {
            file: { id: fileId },
            document: getOrCreateDocument(projectId, fileId)
        };
    }

    let pending = pendingLoads.get(key);

    if (!pending) {
        pending = loadFromDatabase(projectId, fileId).finally(() => {
            pendingLoads.delete(key);
        });

        pendingLoads.set(key, pending);
    }

    return pending;
}

/*
 * Called after a file was changed through REST / the AI agent.
 *
 * If the file is currently live in Yjs, apply the change as a minimal
 * diff. The document "update" listener then broadcasts it to every
 * connected collaborator, so nobody has to refresh.
 */
export function syncLiveDocumentFromDatabase(projectId, fileId, content) {
    const document = getDocument(projectId, fileId);

    if (!document) {
        return false;
    }

    return replaceTextWithDiff(
        document.getText("content"),
        content ?? "",
        "database"
    );
}

export function unloadFileFromYjs(projectId, fileId) {
    initializedDocuments.delete(getKey(projectId, fileId));
    return deleteDocument(projectId, fileId);
}