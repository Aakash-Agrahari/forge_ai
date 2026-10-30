import * as Y from "yjs";

import logger from "../utils/logger.js";

const documents = new Map();

function getDocumentKey(
    projectId,
    fileId
) {
    return `${projectId}:${fileId}`;
}

export function getOrCreateDocument(
    projectId,
    fileId
) {
    const documentKey = getDocumentKey(
        projectId,
        fileId
    );

    let document =
        documents.get(documentKey);

    if (!document) {
        document = new Y.Doc();

        documents.set(
            documentKey,
            document
        );

        logger.info(
            {
                projectId,
                fileId,
                documentKey
            },
            "Yjs document created"
        );
    }

    return document;
}

export function getDocument(
    projectId,
    fileId
) {
    return documents.get(
        getDocumentKey(
            projectId,
            fileId
        )
    );
}

export function getDocumentText(
    projectId,
    fileId
) {
    const document =
        getOrCreateDocument(
            projectId,
            fileId
        );

    return document.getText("content");
}

export function deleteDocument(
    projectId,
    fileId
) {
    const documentKey =
        getDocumentKey(
            projectId,
            fileId
        );

    const deleted =
        documents.delete(documentKey);

    if (deleted) {
        logger.info(
            {
                projectId,
                fileId,
                documentKey
            },
            "Yjs document deleted"
        );
    }

    return deleted;
}

export function getDocumentCount() {
    return documents.size;
}