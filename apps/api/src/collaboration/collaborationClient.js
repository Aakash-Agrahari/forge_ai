//this file implements a client for collaborative editing using Yjs. It manages WebSocket connections, Yjs documents, and text synchronization with a server.
import * as Y from "yjs";

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

        this.connected = false;
    }

    connect() {
        if (this.socket) {
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

        this.socket = new WebSocket(wsUrl);

        this.socket.addEventListener("open", () => {
            this.connected = true;
            this.onConnectionChange?.(true);
        });

        this.socket.addEventListener("close", () => {
            this.connected = false;
            this.onConnectionChange?.(false);
            this.socket = null;
        });

        this.socket.addEventListener("error", () => {
            this.connected = false;
            this.onConnectionChange?.(false);
        });

        this.socket.addEventListener("message", (event) => {
            this.handleMessage(event.data);
        });
    }

    handleMessage(rawMessage) {
        let message;

        try {
            message = JSON.parse(rawMessage);
        } catch {
            return;
        }

        switch (message.type) {
            case "collaboration.authenticated":
                break;

            case "yjs.sync.state":
                this.handleSyncState(message);
                break;

            case "yjs.update":
                this.handleRemoteUpdate(message);
                break;

            default:
                break;
        }
    }

    openFile(fileId) {
        if (!fileId) {
            return null;
        }

        let document = this.documents.get(fileId);

        if (!document) {
            document = new Y.Doc();

            const text = document.getText("content");

            document.on("update", (update, origin) => {
                // Do not send updates received from the server
                // back to the server.
                if (origin === "remote") {
                    return;
                }

                this.sendUpdate(fileId, update);
            });

            this.documents.set(fileId, document);
            this.texts.set(fileId, text);

            this.requestSync(fileId);
        }

        return document;
    }

    getText(fileId) {
        return this.texts.get(fileId) ?? null;
    }

    requestSync(fileId) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        this.socket.send(
            JSON.stringify({
                type: "yjs.sync.request",
                fileId
            })
        );
    }

    sendUpdate(fileId, update) {
        if (
            !this.socket ||
            this.socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        const base64Update = this.uint8ArrayToBase64(update);

        this.socket.send(
            JSON.stringify({
                type: "yjs.update",
                fileId,
                update: base64Update
            })
        );
    }

    handleSyncState(message) {
        const {
            fileId,
            state
        } = message;

        if (!fileId || !state) {
            return;
        }

        const document = this.documents.get(fileId);

        if (!document) {
            return;
        }

        const update = this.base64ToUint8Array(state);

        Y.applyUpdate(
            document,
            update,
            "remote"
        );

        this.onRemoteUpdate?.(
            fileId,
            this.texts.get(fileId)?.toString() ?? ""
        );
    }

    handleRemoteUpdate(message) {
        const {
            fileId,
            update
        } = message;

        if (!fileId || !update) {
            return;
        }

        const document = this.documents.get(fileId);

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

        this.onRemoteUpdate?.(
            fileId,
            this.texts.get(fileId)?.toString() ?? ""
        );
    }

    updateFileContent(fileId, content) {
        const text = this.texts.get(fileId);

        if (!text) {
            return;
        }

        const currentContent = text.toString();

        if (currentContent === content) {
            return;
        }

        text.doc?.transact(() => {
            text.delete(0, text.length);

            if (content.length > 0) {
                text.insert(0, content);
            }
        });
    }

    closeFile(fileId) {
        const document = this.documents.get(fileId);

        if (!document) {
            return;
        }

        document.destroy();

        this.documents.delete(fileId);
        this.texts.delete(fileId);
    }

    disconnect() {
        for (const document of this.documents.values()) {
            document.destroy();
        }

        this.documents.clear();
        this.texts.clear();

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.connected = false;
        this.onConnectionChange?.(false);
    }

    uint8ArrayToBase64(uint8Array) {
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

    base64ToUint8Array(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return bytes;
    }
}