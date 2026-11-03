import * as Y from "yjs";

export class CollaborationClient {
    constructor({
        shareToken,
        onConnectionChange,
        onRemoteUpdate,
    }) {
        this.shareToken = shareToken;
        this.onConnectionChange =
            onConnectionChange;
        this.onRemoteUpdate = onRemoteUpdate;

        this.socket = null;

        // fileId -> Y.Doc
        this.documents = new Map();

        // fileId -> Y.Text
        this.texts = new Map();

        // fileId -> Monaco editor
        this.editors = new Map();

        // fileId -> Monaco change subscription
        this.editorSubscriptions = new Map();

        // Files for which the initial Yjs state
        // has already been received.
        this.syncedFiles = new Set();

        // Prevent Monaco changes caused by
        // remote Yjs updates from being sent
        // back into Yjs.
        this.applyingRemoteChange = new Set();

        // Used only during the initial sync.
        // We don't want the initial Yjs state
        // to be treated as an incremental editor change.
        this.suppressRemoteObserver = new Set();

        this.connected = false;
        this.shouldReconnect = true;
        this.reconnectTimer = null;
    }



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
            window.location.protocol === "https:"
                ? "wss:"
                : "ws:";

        const wsUrl =
            `${protocol}//${window.location.host}` +
            `/ws/collaboration?shareToken=${encodeURIComponent(
                this.shareToken
            )}`;

        const socket = new WebSocket(wsUrl);

        this.socket = socket;

        socket.addEventListener(
            "open",
            () => {
                /*
                * Ignore this event if this socket is no
                * longer the active socket.
                */
                if (this.socket !== socket) {
                    return;
                }

                this.connected = true;

                this.onConnectionChange?.(
                    true
                );

                /*
                * Re-sync every file that already has
                * a Yjs document.
                */
                for (
                    const fileId of this.documents.keys()
                ) {
                    this.requestSync(fileId);
                }
            }
        );

        socket.addEventListener(
            "close",
            () => {
                /*
                * Ignore an old socket closing after a
                * newer socket has already been created.
                */
                if (this.socket !== socket) {
                    return;
                }

                this.connected = false;

                this.onConnectionChange?.(
                    false
                );

                this.socket = null;

                /*
                * Reconnect automatically if this client
                * is still supposed to be active.
                */
                if (
                    this.shouldReconnect &&
                    !this.reconnectTimer
                ) {
                    this.reconnectTimer =
                        window.setTimeout(() => {
                            this.reconnectTimer = null;

                            if (
                                this.shouldReconnect
                            ) {
                                this.connect();
                            }
                        }, 1000);
                }
            }
        );

        socket.addEventListener(
            "error",
            () => {
                /*
                * The close event will normally follow.
                * Reconnection is handled there so that
                * we don't create two reconnect attempts.
                */
                if (this.socket !== socket) {
                    return;
                }

                this.connected = false;

                this.onConnectionChange?.(
                    false
                );
            }
        );

        socket.addEventListener(
            "message",
            (event) => {
                if (this.socket !== socket) {
                    return;
                }

                this.handleMessage(
                    event.data
                );
            }
        );
    }

    handleMessage(rawMessage) {
        let message;

        try {
            message =
                JSON.parse(rawMessage);
        } catch {
            return;
        }

        switch (message.type) {
            case "collaboration.authenticated":
                break;

            case "yjs.sync.state":
                this.handleSyncState(
                    message
                );
                break;

            case "yjs.update":
                this.handleRemoteUpdate(
                    message
                );
                break;

            default:
                break;
        }
    }

    openFile(fileId) {
        if (!fileId) {
            return null;
        }

        let document =
            this.documents.get(fileId);

        if (!document) {
            document = new Y.Doc();

            const text =
                document.getText("content");

            /*
             * Yjs -> Monaco observer.
             */
            text.observe((event) => {
                if (
                    event.transaction.origin ===
                    "monaco"
                ) {
                    return;
                }

                if (
                    event.transaction.origin ===
                    "remote"
                ) {
                    return;
                }

                if (
                    this.suppressRemoteObserver.has(
                        fileId
                    )
                ) {
                    return;
                }
            });

            /*
             * Yjs document -> WebSocket.
             */
            document.on(
                "update",
                (update, origin) => {
                    /*
                     * Remote updates came from the
                     * collaboration server and must
                     * not be sent back.
                     */
                    if (origin === "remote") {
                        return;
                    }

                    this.sendUpdate(
                        fileId,
                        update
                    );
                }
            );

            this.documents.set(
                fileId,
                document
            );

            this.texts.set(
                fileId,
                text
            );

            this.requestSync(fileId);
        }

        return document;
    }

    bindEditor(fileId, editor) {
        if (!fileId || !editor) {
            return;
        }

        this.openFile(fileId);

        /*
         * If this Monaco editor was previously
         * associated with another file, remove
         * that old binding.
         */
        for (const [
            boundFileId,
            boundEditor
        ] of this.editors.entries()) {
            if (
                boundEditor === editor &&
                boundFileId !== fileId
            ) {
                this.unbindEditor(
                    boundFileId
                );
            }
        }

        /*
         * Remove an existing binding for
         * this file before creating a new one.
         */
        this.unbindEditor(fileId);

        this.editors.set(
            fileId,
            editor
        );

        const subscription =
            editor.onDidChangeModelContent(
                (event) => {
                    /*
                     * This change was caused by
                     * applying a remote Yjs update.
                     */
                    if (
                        this.applyingRemoteChange.has(
                            fileId
                        )
                    ) {
                        return;
                    }

                    const text =
                        this.texts.get(fileId);

                    if (!text) {
                        return;
                    }

                    /*
                     * Monaco gives us offsets based on
                     * the document before the changes.
                     *
                     * Apply changes from the end of
                     * the document toward the beginning
                     * so offsets remain valid.
                     */
                    const changes = [
                        ...event.changes
                    ].sort(
                        (a, b) =>
                            b.rangeOffset -
                            a.rangeOffset
                    );

                    text.doc?.transact(
                        () => {
                            for (
                                const change of changes
                            ) {
                                if (
                                    change.rangeLength >
                                    0
                                ) {
                                    text.delete(
                                        change.rangeOffset,
                                        change.rangeLength
                                    );
                                }

                                if (
                                    change.text
                                ) {
                                    text.insert(
                                        change.rangeOffset,
                                        change.text
                                    );
                                }
                            }
                        },
                        "monaco"
                    );
                }
            );

        this.editorSubscriptions.set(
            fileId,
            subscription
        );

        /*
         * If this file has already received its
         * Yjs state, immediately synchronize
         * Monaco with it.
         */
        if (
            this.syncedFiles.has(fileId)
        ) {
            this.setEditorContentFromYjs(
                fileId
            );
        }
    }

    unbindEditor(fileId) {
        const subscription =
            this.editorSubscriptions.get(
                fileId
            );

        if (subscription) {
            subscription.dispose();
        }

        this.editorSubscriptions.delete(
            fileId
        );

        this.editors.delete(fileId);
    }

    getText(fileId) {
        return (
            this.texts.get(fileId) ??
            null
        );
    }

    requestSync(fileId) {
        if (
            !this.socket ||
            this.socket.readyState !== WebSocket.OPEN
        ) {
            console.log(
                "[Collaboration] Cannot request sync - socket not open",
                fileId
            );
            return;
        }

        console.log(
            "[Collaboration] Sending yjs.sync.request",
            fileId
        );

        this.socket.send(
            JSON.stringify({
                type: "yjs.sync.request",
                payload: {
                    fileId,
                },
            })
        );
    }

    sendUpdate(fileId, update) {
        if (
            !this.socket ||
            this.socket.readyState !== WebSocket.OPEN
        ) {
            console.log(
                "[Collaboration] Cannot send update - socket not open",
                fileId
            );
            return;
        }

        const base64Update =
            this.uint8ArrayToBase64(update);

        console.log(
            "[Collaboration] Sending yjs.update",
            {
                fileId,
                updateBytes: update.length,
            }
        );

        this.socket.send(
            JSON.stringify({
                type: "yjs.update",
                payload: {
                    fileId,
                    update: base64Update,
                },
            })
        );
    }

    handleSyncState(message) {
        const {
            fileId,
            state,
        } = message.payload ?? {};

        console.log(
            "[Collaboration] Received yjs.sync.state",
            {
                fileId,
                stateBytes: state?.length ?? 0,
            }
        );

        if (!fileId || !state) {
            return;
        }

        const document =
            this.documents.get(fileId);

        if (!document) {
            return;
        }

        const update =
            this.base64ToUint8Array(
                state
            );

        /*
         * Initial state is special.
         *
         * We don't want the initial Yjs state
         * to be interpreted as an incremental
         * Monaco edit.
         */
        this.suppressRemoteObserver.add(
            fileId
        );

        try {
            Y.applyUpdate(
                document,
                update,
                "remote"
            );
        } finally {
            this.suppressRemoteObserver.delete(
                fileId
            );
        }

        this.syncedFiles.add(fileId);

        /*
         * Now that the initial Yjs state is
         * available, make Monaco exactly match it.
         */
        this.setEditorContentFromYjs(
            fileId
        );

        this.onRemoteUpdate?.(
            fileId,
            this.texts
                .get(fileId)
                ?.toString() ?? ""
        );
    }

    handleRemoteUpdate(message) {
        const {
            fileId,
            update,
        } = message.payload ?? {};

        console.log(
            "[Collaboration] Received yjs.update",
            {
                fileId,
                updateBytes: update?.length ?? 0,
            }
        );

        if (!fileId || !update) {
            return;
        }

        const document =
            this.documents.get(fileId);

        if (!document) {
            return;
        }

        const decodedUpdate =
            this.base64ToUint8Array(update);

        Y.applyUpdate(
            document,
            decodedUpdate,
            "remote"
        );

        const editor =
            this.editors.get(fileId);

        const text =
            this.texts.get(fileId);

        if (!editor || !text) {
            return;
        }

        const content =
            text.toString();

        if (editor.getValue() === content) {
            return;
        }

        this.applyingRemoteChange.add(fileId);

        try {
            const model = editor.getModel();

            if (!model) {
                return;
            }

            model.pushEditOperations(
                [],
                [
                    {
                        range: model.getFullModelRange(),
                        text: content,
                    },
                ],
                () => null
            );
        } finally {
            this.applyingRemoteChange.delete(fileId);
        }

        this.onRemoteUpdate?.(
            fileId,
            content
        );
    }

    setEditorContentFromYjs(fileId) {
        const editor =
            this.editors.get(fileId);

        const text =
            this.texts.get(fileId);

        if (!editor || !text) {
            return;
        }

        const content =
            text.toString();

        if (
            editor.getValue() ===
            content
        ) {
            return;
        }

        this.applyingRemoteChange.add(
            fileId
        );

        try {
            editor.setValue(
                content
            );
        } finally {
            this.applyingRemoteChange.delete(
                fileId
            );
        }
    }

    applyYjsDeltaToEditor(
        fileId,
        delta
    ) {
        const editor =
            this.editors.get(fileId);

        if (!editor) {
            return;
        }

        const model =
            editor.getModel();

        if (!model) {
            return;
        }

        const edits = [];

        let offset = 0;

        for (const operation of delta) {
            if (
                typeof operation.retain ===
                "number"
            ) {
                offset +=
                    operation.retain;
            }

            if (
                typeof operation.insert ===
                "string"
            ) {
                const position =
                    model.getPositionAt(
                        offset
                    );

                edits.push({
                    range: {
                        startLineNumber:
                            position.lineNumber,
                        startColumn:
                            position.column,
                        endLineNumber:
                            position.lineNumber,
                        endColumn:
                            position.column,
                    },
                    text: operation.insert,
                    forceMoveMarkers: true,
                });

                offset +=
                    operation.insert.length;
            }

            if (
                typeof operation.delete ===
                "number"
            ) {
                const startPosition =
                    model.getPositionAt(
                        offset
                    );

                const endPosition =
                    model.getPositionAt(
                        offset +
                            operation.delete
                    );

                edits.push({
                    range: {
                        startLineNumber:
                            startPosition.lineNumber,
                        startColumn:
                            startPosition.column,
                        endLineNumber:
                            endPosition.lineNumber,
                        endColumn:
                            endPosition.column,
                    },
                    text: "",
                    forceMoveMarkers: true,
                });
            }
        }

        if (edits.length === 0) {
            return;
        }

        this.applyingRemoteChange.add(
            fileId
        );

        try {
            editor.executeEdits(
                "forgeai-collaboration",
                edits
            );
        } finally {
            this.applyingRemoteChange.delete(
                fileId
            );
        }
    }

    /*
     * Kept for compatibility.
     *
     * The main Monaco collaboration path now
     * uses bindEditor() instead.
     */
    updateFileContent(
        fileId,
        content
    ) {
        const text =
            this.texts.get(fileId);

        if (!text) {
            return;
        }

        const currentContent =
            text.toString();

        if (
            currentContent ===
            content
        ) {
            return;
        }

        text.doc?.transact(
            () => {
                text.delete(
                    0,
                    text.length
                );

                if (content.length > 0) {
                    text.insert(
                        0,
                        content
                    );
                }
            },
            "api"
        );
    }

    closeFile(fileId) {
        this.unbindEditor(fileId);

        const document =
            this.documents.get(fileId);

        if (!document) {
            return;
        }

        document.destroy();

        this.documents.delete(
            fileId
        );

        this.texts.delete(
            fileId
        );

        this.syncedFiles.delete(
            fileId
        );

        this.applyingRemoteChange.delete(
            fileId
        );

        this.suppressRemoteObserver.delete(
            fileId
        );
    }

    disconnect() {
        this.shouldReconnect = false;

        if (this.reconnectTimer) {
            window.clearTimeout(
                this.reconnectTimer
            );

            this.reconnectTimer = null;
        }

        for (
            const fileId of this.editorSubscriptions.keys()
        ) {
            this.unbindEditor(fileId);
        }

        this.syncedFiles.clear();

        for (const document of this.documents.values()) {
            document.destroy();
        }

        this.documents.clear();
        this.texts.clear();

        if (this.socket) {
            this.socket.onopen = null;
            this.socket.onmessage = null;
            this.socket.onerror = null;
            this.socket.onclose = null;

            if (
                this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING
            ) {
                this.socket.close();
            }

            this.socket = null;
        }

        this.connected = false;
    }

    uint8ArrayToBase64(
        uint8Array
    ) {
        let binary = "";

        const chunkSize = 0x8000;

        for (
            let i = 0;
            i < uint8Array.length;
            i += chunkSize
        ) {
            binary += String.fromCharCode(
                ...uint8Array.subarray(
                    i,
                    Math.min(
                        i + chunkSize,
                        uint8Array.length
                    )
                )
            );
        }

        return btoa(binary);
    }

    base64ToUint8Array(
        base64
    ) {
        const binary =
            atob(base64);

        const bytes =
            new Uint8Array(
                binary.length
            );

        for (
            let i = 0;
            i < binary.length;
            i++
        ) {
            bytes[i] =
                binary.charCodeAt(i);
        }

        return bytes;
    }
}