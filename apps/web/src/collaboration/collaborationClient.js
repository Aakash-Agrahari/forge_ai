import * as Y from "yjs";

const MONACO_ORIGIN = "monaco";
const REMOTE_ORIGIN = "remote";

// If the server never answers a sync request, never leave the editor locked.
const SYNC_LOCK_TIMEOUT_MS = 5000;
const RECONNECT_DELAY_MS = 1000;

function toBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(index, index + chunkSize)
        );
    }

    return btoa(binary);
}

function fromBase64(encoded) {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

/*
 * Smallest single edit that turns `current` into `next`
 * (common prefix and suffix are kept).
 */
function computeTextDiff(current, next) {
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
    if (start > 0) {
        const code = current.charCodeAt(start - 1);
        if (code >= 0xd800 && code <= 0xdbff) {
            start--;
        }
    }

    if (currentEnd < current.length) {
        const code = current.charCodeAt(currentEnd);
        if (code >= 0xdc00 && code <= 0xdfff) {
            currentEnd++;
            nextEnd++;
        }
    }

    return { start, currentEnd, nextEnd };
}

export class CollaborationClient {
    constructor({ shareToken, onConnectionChange, onRemoteUpdate }) {
        this.shareToken = shareToken;
        this.onConnectionChange = onConnectionChange;
        this.onRemoteUpdate = onRemoteUpdate;

        this.socket = null;

        // fileId -> Y.Doc
        this.documents = new Map();

        // fileId -> Y.Text
        this.texts = new Map();

        // fileId -> Monaco editor
        this.editors = new Map();

        // fileId -> Monaco text model the editor showed when it was bound
        this.boundModels = new Map();

        // fileId -> Monaco change subscription
        this.editorSubscriptions = new Map();

        // Files for which the server state has been received.
        this.syncedFiles = new Set();

        // Editors temporarily read-only while the first sync is in flight.
        this.lockedEditors = new Set();

        // Prevent Monaco changes caused by remote Yjs updates
        // from being sent back into Yjs.
        this.applyingRemoteChange = new Set();

        // `connected` === socket open AND the server accepted us.
        this.connected = false;
        this.authenticated = false;

        this.shouldReconnect = true;
        this.reconnectTimer = null;
    }

    /* =========================
       CONNECTION
    ========================= */

    connect() {
        this.shouldReconnect = true;

        if (
            this.socket &&
            (
                this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING
            )
        ) {
            return;
        }

        const protocol =
            window.location.protocol === "https:" ? "wss:" : "ws:";

        const wsUrl =
            `${protocol}//${window.location.host}` +
            `/ws/collaboration?shareToken=${encodeURIComponent(
                this.shareToken
            )}`;

        const socket = new WebSocket(wsUrl);

        this.socket = socket;

        /*
         * NOTE: nothing is sent on "open". The server still has to
         * authenticate us; we wait for `collaboration.authenticated`
         * (see handleAuthenticated) before syncing any file.
         */

        socket.addEventListener("message", (event) => {
            if (this.socket !== socket) {
                return;
            }

            this.handleMessage(event.data);
        });

        socket.addEventListener("close", () => {
            // Ignore an old socket closing after a newer one was created.
            if (this.socket !== socket) {
                return;
            }

            this.socket = null;
            this.connected = false;
            this.authenticated = false;

            // Never leave an editor locked because the socket dropped.
            this.releaseAllEditorLocks();

            this.onConnectionChange?.(false);

            if (this.shouldReconnect && !this.reconnectTimer) {
                this.reconnectTimer = window.setTimeout(() => {
                    this.reconnectTimer = null;

                    if (this.shouldReconnect) {
                        this.connect();
                    }
                }, RECONNECT_DELAY_MS);
            }
        });

        socket.addEventListener("error", () => {
            // The "close" event follows and handles reconnection.
        });
    }

    handleMessage(rawMessage) {
        let message;

        try {
            message = JSON.parse(rawMessage);
        } catch {
            return;
        }

        switch (message?.type) {
            case "collaboration.authenticated":
                this.handleAuthenticated();
                break;

            case "yjs.sync.state":
                this.handleSyncState(message);
                break;

            case "yjs.update":
                this.handleRemoteUpdate(message);
                break;

            case "collaboration.error":
                console.warn("Collaboration error:", message);
                // Don't keep the editor locked if sync failed.
                if (message.fileId) {
                    this.unlockEditor(message.fileId);
                } else {
                    this.releaseAllEditorLocks();
                }
                break;

            default:
                break;
        }
    }

    handleAuthenticated() {
        this.authenticated = true;
        this.connected = true;

        this.onConnectionChange?.(true);

        /*
         * (Re)sync every file that already has a Yjs document.
         * Because we send our state vector, edits made while we were
         * offline are merged instead of lost.
         */
        for (const fileId of this.documents.keys()) {
            this.lockEditorUntilSynced(fileId);
            this.requestSync(fileId);
        }
    }

    /* =========================
       DOCUMENTS
    ========================= */

    openFile(fileId) {
        if (!fileId) {
            return null;
        }

        const existingDocument = this.documents.get(fileId);

        if (existingDocument) {
            if (this.authenticated && !this.syncedFiles.has(fileId)) {
                this.requestSync(fileId);
            }

            return existingDocument;
        }

        const document = new Y.Doc();
        const text = document.getText("content");

        this.documents.set(fileId, document);
        this.texts.set(fileId, text);

        /*
         * Live remote edits -> editor.
         *
         * Skipped for:
         *  - edits that came from this very editor (it already has them),
         *  - files that haven't done their first sync yet (the full
         *    content is applied once, in handleSyncState).
         */
        text.observe((event) => {
            if (event.transaction.origin === MONACO_ORIGIN) {
                return;
            }

            if (!this.syncedFiles.has(fileId)) {
                return;
            }

            this.applyYjsDeltaToEditor(fileId, event.delta);
        });

        // Local Yjs change -> server.
        document.on("update", (update, origin) => {
            if (origin === REMOTE_ORIGIN) {
                return;
            }

            this.sendUpdate(fileId, update);
        });

        if (this.authenticated) {
            this.requestSync(fileId);
        }

        return document;
    }

    closeFile(fileId) {
        this.unbindEditor(fileId);

        const document = this.documents.get(fileId);

        if (document) {
            document.destroy();
        }

        this.documents.delete(fileId);
        this.texts.delete(fileId);
        this.syncedFiles.delete(fileId);
        this.applyingRemoteChange.delete(fileId);
    }

    getText(fileId) {
        return this.texts.get(fileId)?.toString() ?? "";
    }

    /*
     * Programmatically replace the file content (minimal diff).
     */
    updateFileContent(fileId, content) {
        const text = this.texts.get(fileId);

        if (!text || !this.syncedFiles.has(fileId)) {
            return false;
        }

        const current = text.toString();
        const next = content ?? "";

        if (current === next) {
            return false;
        }

        const { start, currentEnd, nextEnd } = computeTextDiff(current, next);

        text.doc.transact(() => {
            if (currentEnd > start) {
                text.delete(start, currentEnd - start);
            }

            if (nextEnd > start) {
                text.insert(start, next.slice(start, nextEnd));
            }
        }, "api");

        return true;
    }

    /* =========================
       EDITOR BINDING
    ========================= */

    bindEditor(fileId, editor) {
        if (!fileId || !editor) {
            return;
        }

        const model = editor.getModel?.();

        if (!model) {
            return;
        }

        this.openFile(fileId);

        // Already bound to this exact editor + model: just reconcile.
        if (
            this.editors.get(fileId) === editor &&
            this.boundModels.get(fileId) === model
        ) {
            if (this.syncedFiles.has(fileId)) {
                this.setEditorContentFromYjs(fileId);
            }

            return;
        }

        // One editor can only show one file at a time.
        for (const [otherFileId, otherEditor] of [...this.editors]) {
            if (otherEditor === editor && otherFileId !== fileId) {
                this.unbindEditor(otherFileId);
            }
        }

        this.unbindEditor(fileId);

        this.editors.set(fileId, editor);
        this.boundModels.set(fileId, model);

        // Local typing -> Yjs.
        const subscription = editor.onDidChangeModelContent((event) => {
            if (this.applyingRemoteChange.has(fileId)) {
                return;
            }

            // The editor may already be showing another file's model.
            if (editor.getModel() !== model) {
                return;
            }

            // Offsets only match once Monaco and Yjs hold the same text.
            if (!this.syncedFiles.has(fileId)) {
                return;
            }

            const document = this.documents.get(fileId);
            const text = this.texts.get(fileId);

            if (!document || !text) {
                return;
            }

            // Apply from the end so earlier offsets stay valid.
            const changes = [...event.changes].sort(
                (a, b) => b.rangeOffset - a.rangeOffset
            );

            try {
                document.transact(() => {
                    for (const change of changes) {
                        if (change.rangeLength > 0) {
                            text.delete(change.rangeOffset, change.rangeLength);
                        }

                        if (change.text) {
                            text.insert(change.rangeOffset, change.text);
                        }
                    }
                }, MONACO_ORIGIN);
            } catch (error) {
                console.error("Failed to apply editor change to Yjs:", error);

                // Re-align the editor with the shared document.
                this.setEditorContentFromYjs(fileId);
            }
        });

        this.editorSubscriptions.set(fileId, subscription);

        if (this.syncedFiles.has(fileId)) {
            this.setEditorContentFromYjs(fileId);
        } else {
            this.lockEditorUntilSynced(fileId);

            if (this.authenticated) {
                this.requestSync(fileId);
            }
        }
    }

    unbindEditor(fileId) {
        this.unlockEditor(fileId);

        const subscription = this.editorSubscriptions.get(fileId);

        if (subscription) {
            try {
                subscription.dispose();
            } catch {
                // editor already disposed
            }
        }

        this.editorSubscriptions.delete(fileId);
        this.editors.delete(fileId);
        this.boundModels.delete(fileId);
    }

    /*
     * Returns the editor bound to a file ONLY if it is still alive and
     * still showing that file's model (guards against disposed editors
     * and against file switches).
     */
    getLiveEditor(fileId) {
        const editor = this.editors.get(fileId);

        if (!editor) {
            return null;
        }

        let model = null;

        try {
            model = editor.getModel();
        } catch {
            model = null;
        }

        if (!model || model !== this.boundModels.get(fileId)) {
            return null;
        }

        return editor;
    }

    lockEditorUntilSynced(fileId) {
        if (this.syncedFiles.has(fileId)) {
            return;
        }

        const editor = this.getLiveEditor(fileId);

        if (!editor || this.lockedEditors.has(editor)) {
            return;
        }

        try {
            editor.updateOptions({ readOnly: true });
            this.lockedEditors.add(editor);
        } catch {
            return;
        }

        window.setTimeout(() => {
            if (!this.syncedFiles.has(fileId)) {
                this.unlockEditor(fileId);
            }
        }, SYNC_LOCK_TIMEOUT_MS);
    }

    unlockEditor(fileId) {
        const editor = this.editors.get(fileId);

        if (!editor || !this.lockedEditors.has(editor)) {
            return;
        }

        this.lockedEditors.delete(editor);

        try {
            editor.updateOptions({ readOnly: false });
        } catch {
            // editor already disposed
        }
    }

    releaseAllEditorLocks() {
        for (const fileId of [...this.editors.keys()]) {
            this.unlockEditor(fileId);
        }
    }

    /* =========================
       NETWORK
    ========================= */

    send(message) {
        if (
            !this.authenticated ||
            !this.socket ||
            this.socket.readyState !== WebSocket.OPEN
        ) {
            return false;
        }

        this.socket.send(JSON.stringify(message));

        return true;
    }

    requestSync(fileId) {
        const document = this.documents.get(fileId);

        if (!document) {
            return;
        }

        this.send({
            type: "yjs.sync.request",
            payload: {
                fileId,
                stateVector: toBase64(Y.encodeStateVector(document))
            }
        });
    }

    sendUpdate(fileId, update) {
        /*
         * If we're offline the update is simply not sent now. It lives in
         * our Y.Doc and is delivered by the state-vector handshake on
         * reconnect, so nothing is lost.
         */
        this.send({
            type: "yjs.update",
            payload: {
                fileId,
                update: toBase64(update)
            }
        });
    }

    /* =========================
       INCOMING
    ========================= */

    // The server lost its in-memory state (e.g. restarted).
    serverLostHistory(document, serverStateVector) {
        const local = Y.decodeStateVector(Y.encodeStateVector(document));
        const server = Y.decodeStateVector(serverStateVector);

        for (const [clientId, clock] of local) {
            if (clientId === document.clientID) {
                continue;
            }

            if ((server.get(clientId) || 0) < clock) {
                return true;
            }
        }

        return false;
    }

    handleSyncState(message) {
        const { fileId, state, stateVector } = message.payload || {};

        const document = this.documents.get(fileId);

        if (!document || typeof state !== "string") {
            return;
        }

        /*
         * If the server restarted it rebuilt the file from the database
         * with brand-new Yjs items. Merging our old history on top would
         * duplicate the text, so start this file again from the server.
         */
        if (
            stateVector &&
            this.syncedFiles.has(fileId) &&
            this.serverLostHistory(document, fromBase64(stateVector))
        ) {
            this.resetDocument(fileId);
            return;
        }

        Y.applyUpdate(document, fromBase64(state), REMOTE_ORIGIN);

        this.syncedFiles.add(fileId);

        // Send the server anything it is missing (our offline edits).
        if (stateVector) {
            const missing = Y.encodeStateAsUpdate(
                document,
                fromBase64(stateVector)
            );

            // An empty update is 2 bytes.
            if (missing.length > 2) {
                this.sendUpdate(fileId, missing);
            }
        }

        this.setEditorContentFromYjs(fileId);
    }

    resetDocument(fileId) {
        const editor = this.editors.get(fileId);
        const model = this.boundModels.get(fileId);

        const oldDocument = this.documents.get(fileId);

        if (oldDocument) {
            oldDocument.destroy();
        }

        this.documents.delete(fileId);
        this.texts.delete(fileId);
        this.syncedFiles.delete(fileId);

        // Keep the editor bound; it will be refreshed on the next sync.
        this.openFile(fileId);

        if (editor && model) {
            this.editors.set(fileId, editor);
            this.boundModels.set(fileId, model);
        }
    }

    handleRemoteUpdate(message) {
        const { fileId, update } = message.payload || {};

        const document = this.documents.get(fileId);

        if (!document || typeof update !== "string") {
            return;
        }

        // The Y.Text observer applies the change to the editor live.
        Y.applyUpdate(document, fromBase64(update), REMOTE_ORIGIN);

        if (!this.syncedFiles.has(fileId)) {
            return;
        }

        const text = this.texts.get(fileId);
        const content = text.toString();
        const editor = this.getLiveEditor(fileId);

        // Safety net: if the incremental patch ever drifted, realign.
        if (editor && editor.getModel().getValue() !== content) {
            this.setEditorContentFromYjs(fileId);
            return;
        }

        this.onRemoteUpdate?.(fileId, content);
    }

    /* =========================
       YJS -> MONACO
    ========================= */

    setEditorContentFromYjs(fileId) {
        const text = this.texts.get(fileId);

        if (!text) {
            return;
        }

        const content = text.toString();
        const editor = this.getLiveEditor(fileId);

        if (editor) {
            const model = editor.getModel();
            const current = model.getValue();

            if (current !== content) {
                const { start, currentEnd, nextEnd } =
                    computeTextDiff(current, content);

                const startPosition = model.getPositionAt(start);
                const endPosition = model.getPositionAt(currentEnd);

                this.applyingRemoteChange.add(fileId);

                try {
                    model.applyEdits([
                        {
                            range: {
                                startLineNumber: startPosition.lineNumber,
                                startColumn: startPosition.column,
                                endLineNumber: endPosition.lineNumber,
                                endColumn: endPosition.column
                            },
                            text: content.slice(start, nextEnd)
                        }
                    ]);
                } finally {
                    this.applyingRemoteChange.delete(fileId);
                }
            }

            this.unlockEditor(fileId);
        }

        this.onRemoteUpdate?.(fileId, content);
    }

    /*
     * Apply a Y.Text delta to Monaco as precise edits (keeps the local
     * cursor, selection, scroll position and undo history intact).
     *
     * Delta positions walk through the ORIGINAL text: `retain` and
     * `delete` consume it, `insert` does not. All offsets are converted
     * to positions before any edit is applied, because Monaco expects
     * every range of a batch to refer to the pre-edit model.
     */
    applyYjsDeltaToEditor(fileId, delta) {
        const editor = this.getLiveEditor(fileId);

        if (!editor || !delta?.length) {
            return;
        }

        const model = editor.getModel();

        const edits = [];
        let offset = 0;

        for (const operation of delta) {
            if (operation.retain != null) {
                offset += operation.retain;
            } else if (operation.delete != null) {
                edits.push({
                    start: offset,
                    end: offset + operation.delete,
                    text: ""
                });

                offset += operation.delete;
            } else if (typeof operation.insert === "string") {
                edits.push({
                    start: offset,
                    end: offset,
                    text: operation.insert
                });
            }
        }

        if (edits.length === 0) {
            return;
        }

        const monacoEdits = edits.map((edit) => {
            const startPosition = model.getPositionAt(edit.start);
            const endPosition = model.getPositionAt(edit.end);

            return {
                range: {
                    startLineNumber: startPosition.lineNumber,
                    startColumn: startPosition.column,
                    endLineNumber: endPosition.lineNumber,
                    endColumn: endPosition.column
                },
                text: edit.text
            };
        });

        this.applyingRemoteChange.add(fileId);

        try {
            model.applyEdits(monacoEdits);
        } finally {
            this.applyingRemoteChange.delete(fileId);
        }
    }

    /* =========================
       CLEANUP
    ========================= */

    disconnect() {
        this.shouldReconnect = false;

        if (this.reconnectTimer) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.releaseAllEditorLocks();

        for (const fileId of [...this.editors.keys()]) {
            this.unbindEditor(fileId);
        }

        for (const document of this.documents.values()) {
            document.destroy();
        }

        this.documents.clear();
        this.texts.clear();
        this.syncedFiles.clear();
        this.applyingRemoteChange.clear();

        const socket = this.socket;

        this.socket = null;
        this.connected = false;
        this.authenticated = false;

        if (socket) {
            try {
                socket.close();
            } catch {
                // already closed
            }
        }

        this.onConnectionChange?.(false);
    }
}