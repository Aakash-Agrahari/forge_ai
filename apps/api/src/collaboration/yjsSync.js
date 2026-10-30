//this file provides utility functions for encoding and decoding Yjs document states and updates, which are used for collaborative editing.
import * as Y from "yjs";

export function encodeDocumentState(
    document
) {
    return Y.encodeStateAsUpdate(
        document
    );
}

export function encodeStateVector(
    document
) {
    return Y.encodeStateVector(
        document
    );
}

export function applyDocumentUpdate(
    document,
    update
) {
    Y.applyUpdate(
        document,
        update
    );
}

export function encodeDocumentUpdate(
    update
) {
    return Buffer.from(
        update
    ).toString("base64");
}

export function decodeDocumentUpdate(
    encodedUpdate
) {
    return new Uint8Array(
        Buffer.from(
            encodedUpdate,
            "base64"
        )
    );
}