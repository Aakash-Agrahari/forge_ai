// Utility helpers for encoding/decoding Yjs state and updates used by collaborative editing.
import * as Y from "yjs";

/*
 * Encode the document state.
 *
 * If a state vector is supplied, only the part of the document the
 * other side is missing is returned (standard Yjs sync step 2).
 */
export function encodeDocumentState(document, stateVector) {
    return stateVector
        ? Y.encodeStateAsUpdate(document, stateVector)
        : Y.encodeStateAsUpdate(document);
}

export function encodeStateVector(document) {
    return Y.encodeStateVector(document);
}

/*
 * `origin` identifies who made the change. For client edits the
 * origin is the WebSocket itself so the server never echoes an
 * update back to the client that produced it.
 */
export function applyDocumentUpdate(document, update, origin = null) {
    Y.applyUpdate(document, update, origin);
}

export function encodeDocumentUpdate(update) {
    return Buffer.from(update).toString("base64");
}

export function decodeDocumentUpdate(encodedUpdate) {
    return new Uint8Array(Buffer.from(encodedUpdate, "base64"));
}

/*
 * Replace the content of a Y.Text with `nextContent`, but only touch
 * the part that really changed (common prefix/suffix are kept).
 *
 * Deleting everything and re-inserting it would create a brand new
 * set of Yjs items; every collaborator's cursor and any concurrent
 * typing would be destroyed. A minimal diff avoids that.
 */
export function replaceTextWithDiff(yText, nextContent, origin = null) {
    const current = yText.toString();
    const next = nextContent ?? "";

    if (current === next) {
        return false;
    }

    let start = 0;
    const minLength = Math.min(current.length, next.length);

    while (start < minLength && current[start] === next[start]) {
        start++;
    }

    let currentEnd = current.length;
    let nextEnd = next.length;

    while (
        currentEnd > start &&
        nextEnd > start &&
        current[currentEnd - 1] === next[nextEnd - 1]
    ) {
        currentEnd--;
        nextEnd--;
    }

    // Never split a UTF-16 surrogate pair.
    const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;
    const isLowSurrogate = (code) => code >= 0xdc00 && code <= 0xdfff;

    if (start > 0 && isHighSurrogate(current.charCodeAt(start - 1))) {
        start--;
    }

    if (currentEnd < current.length && isLowSurrogate(current.charCodeAt(currentEnd))) {
        currentEnd++;
        nextEnd++;
    }

    const apply = () => {
        if (currentEnd > start) {
            yText.delete(start, currentEnd - start);
        }

        if (nextEnd > start) {
            yText.insert(start, next.slice(start, nextEnd));
        }
    };

    if (yText.doc) {
        yText.doc.transact(apply, origin);
    } else {
        apply();
    }

    return true;
}