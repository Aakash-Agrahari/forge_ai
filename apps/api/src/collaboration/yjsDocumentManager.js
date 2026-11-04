import * as Y from "yjs";

import logger from "../utils/logger.js";

import { broadcastToProject } from "./collaborationRoomManager.js";
import { encodeDocumentUpdate } from "./yjsSync.js";

const documents = new Map();

function getDocumentKey(projectId, fileId) {
    return `${projectId}:${fileId}`;
}

/*
 * Origins that must NOT be broadcast:
 *  - "init": the first load of the file from PostgreSQL. Every client
 *    receives this state through the normal sync handshake instead.
 */
const SILENT_ORIGINS = new Set(["init"]);

export function getOrCreateDocument(projectId, fileId) {
    const documentKey = getDocumentKey(projectId, fileId);

    let document = documents.get(documentKey);

    if (!document) {
        document = new Y.Doc();

        /*
         * Single place where document changes are fanned out.
         *
         * - Updates coming from a client have that client's socket as
         *   origin -> send to everybody else in the project.
         * - Updates produced on the server (REST save, AI agent, ...)
         *   have a string origin -> send to everybody.
         */
        document.on("update", (update, origin) => {
            if (SILENT_ORIGINS.has(origin)) {
                return;
            }

            const originSocket =
                origin && typeof origin === "object" && origin.collaboration
                    ? origin
                    : null;

            broadcastToProject(
                projectId,
                {
                    type: "yjs.update",
                    payload: {
                        fileId,
                        update: encodeDocumentUpdate(update)
                    },
                    sender: originSocket
                        ? {
                            id: originSocket.collaboration.userId,
                            name: originSocket.collaboration.user?.name
                        }
                        : { id: "server", name: "ForgeAI" }
                },
                originSocket
            );
        });

        documents.set(documentKey, document);

        logger.info(
            { projectId, fileId, documentKey },
            "Yjs document created"
        );
    }

    return document;
}

export function getDocument(projectId, fileId) {
    return documents.get(getDocumentKey(projectId, fileId));
}

export function getDocumentText(projectId, fileId) {
    return getOrCreateDocument(projectId, fileId).getText("content");
}

export function deleteDocument(projectId, fileId) {
    const documentKey = getDocumentKey(projectId, fileId);
    const document = documents.get(documentKey);

    if (!document) {
        return false;
    }

    document.destroy();
    documents.delete(documentKey);

    logger.info(
        { projectId, fileId, documentKey },
        "Yjs document deleted"
    );

    return true;
}

export function getDocumentCount() {
    return documents.size;
}