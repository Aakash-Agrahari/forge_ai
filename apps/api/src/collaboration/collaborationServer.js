import { WebSocketServer } from "ws";

import logger from "../utils/logger.js";

import { authenticateCollaborationRequest } from "./collaborationAuth.js";

import { getCollaborationRoomByToken } from "../services/CollaborationService.js";

import {
    joinRoom,
    leaveRoom,
    broadcastToRoom
} from "./collaborationRoomManager.js";

import { loadFileIntoYjs } from "./yjsFileService.js";

import {
    encodeDocumentState,
    encodeStateVector,
    applyDocumentUpdate,
    encodeDocumentUpdate,
    decodeDocumentUpdate
} from "./yjsSync.js";

const COLLABORATION_PATH = "/ws/collaboration";

function sendJson(socket, message) {
    if (socket.readyState !== 1) {
        return;
    }

    socket.send(JSON.stringify(message));
}

export function createCollaborationServer(server) {
    const wss = new WebSocketServer({
        server,
        path: COLLABORATION_PATH
    });

    wss.on("connection", async (socket, request) => {
        /*
         * IMPORTANT (bug fix)
         * -------------------
         * Authentication needs several database round-trips. The browser
         * considers the socket "open" immediately and used to send its
         * `yjs.sync.request` straight away. Because the "message" listener
         * was only attached AFTER those awaits, those first messages were
         * silently dropped, the file never synchronised and the user only
         * saw changes after a page refresh.
         *
         * Listeners are therefore attached synchronously. Messages that
         * arrive before authentication finishes are queued and replayed.
         */
        let ready = false;
        let closed = false;
        const queuedMessages = [];

        socket.on("message", (rawMessage) => {
            if (!ready) {
                queuedMessages.push(rawMessage);
                return;
            }

            handleRoomMessage(socket, rawMessage);
        });

        socket.on("close", () => {
            closed = true;
            handleSocketClose(socket);
        });

        socket.on("error", (error) => {
            logger.warn(
                {
                    userId: socket.collaboration?.userId,
                    roomId: socket.collaboration?.roomId,
                    error: error.message
                },
                "Collaboration WebSocket error"
            );
        });

        try {
            // 1. Read share token
            const requestUrl = new URL(
                request.url,
                `http://${request.headers.host}`
            );

            const shareToken = requestUrl.searchParams.get("shareToken");

            if (!shareToken) {
                socket.close(1008, "Collaboration share token is required");
                return;
            }

            // 2. Authenticate user
            const authentication =
                await authenticateCollaborationRequest(request);

            if (!authentication.authenticated) {
                logger.warn(
                    { code: authentication.code },
                    "Collaboration WebSocket authentication failed"
                );

                socket.close(1008, authentication.message);
                return;
            }

            // 3. Resolve collaboration room
            const room = await getCollaborationRoomByToken(shareToken);

            if (!room) {
                logger.warn("Invalid or inactive collaboration room");
                socket.close(1008, "Invalid collaboration link");
                return;
            }

            // The client may have disconnected while we were authenticating.
            if (closed || socket.readyState !== 1) {
                return;
            }

            // 4. Attach collaboration metadata
            socket.collaboration = {
                userId: authentication.user.id,
                user: authentication.user,
                roomId: room.id,
                projectId: room.projectId
            };

            // 5. Join room
            const roomSize = joinRoom(room.id, socket);

            logger.info(
                {
                    userId: authentication.user.id,
                    roomId: room.id,
                    projectId: room.projectId,
                    roomSize
                },
                "Authenticated collaboration WebSocket connected"
            );

            // 6. Tell client authentication succeeded
            sendJson(socket, {
                type: "collaboration.authenticated",
                user: {
                    id: authentication.user.id,
                    name: authentication.user.name
                },
                room: {
                    id: room.id,
                    projectId: room.projectId
                },
                roomSize
            });

            // 7. Notify other users
            broadcastToRoom(
                room.id,
                {
                    type: "collaboration.user_joined",
                    user: {
                        id: authentication.user.id,
                        name: authentication.user.name
                    },
                    roomSize
                },
                socket
            );

            // 8. Replay anything that arrived while we were authenticating
            ready = true;

            while (queuedMessages.length > 0) {
                handleRoomMessage(socket, queuedMessages.shift());
            }
        } catch (error) {
            logger.error(
                { error: error.message },
                "Collaboration WebSocket authentication error"
            );

            socket.close(1011, "Collaboration authentication failed");
        }
    });

    logger.info(
        { path: COLLABORATION_PATH },
        "ForgeAI collaboration WebSocket server initialized"
    );

    return wss;
}

function handleRoomMessage(socket, rawMessage) {
    if (!socket.collaboration) {
        return;
    }

    const roomId = socket.collaboration.roomId;

    let message;

    try {
        message = JSON.parse(rawMessage.toString());
    } catch {
        sendJson(socket, {
            type: "collaboration.error",
            code: "INVALID_MESSAGE",
            message: "Message must be valid JSON"
        });

        return;
    }

    if (!message || typeof message.type !== "string") {
        sendJson(socket, {
            type: "collaboration.error",
            code: "INVALID_MESSAGE",
            message: "Message type is required"
        });

        return;
    }

    if (message.type === "yjs.sync.request") {
        void handleYjsSyncRequest(socket, message);
        return;
    }

    if (message.type === "yjs.update") {
        void handleYjsUpdate(socket, message);
        return;
    }

    broadcastToRoom(
        roomId,
        {
            type: message.type,
            payload: message.payload ?? null,
            sender: {
                id: socket.collaboration.userId,
                name: socket.collaboration.user.name
            }
        },
        socket
    );
}

async function handleYjsSyncRequest(socket, message) {
    if (!socket.collaboration) return;

    const { projectId } = socket.collaboration;
    const fileId = message.payload?.fileId;

    if (!fileId) {
        sendJson(socket, {
            type: "collaboration.error",
            code: "FILE_ID_REQUIRED",
            message: "fileId is required"
        });
        return;
    }

    try {
        const result = await loadFileIntoYjs(projectId, fileId);

        if (!result) {
            sendJson(socket, {
                type: "collaboration.error",
                code: "FILE_NOT_FOUND",
                fileId,
                message: "File does not belong to this project"
            });
            return;
        }

        /*
         * Standard Yjs two-way sync:
         *  - the client sends its state vector,
         *  - we answer with only what it is missing + OUR state vector,
         *  - the client then sends back whatever we are missing
         *    (edits it made while disconnected).
         */
        const clientStateVector =
            typeof message.payload?.stateVector === "string"
                ? decodeDocumentUpdate(message.payload.stateVector)
                : undefined;

        const state = encodeDocumentState(
            result.document,
            clientStateVector
        );

        sendJson(socket, {
            type: "yjs.sync.state",
            payload: {
                fileId,
                state: encodeDocumentUpdate(state),
                stateVector: encodeDocumentUpdate(
                    encodeStateVector(result.document)
                )
            }
        });
    } catch (error) {
        logger.error(
            { fileId, error: error.message },
            "Yjs sync failed"
        );

        sendJson(socket, {
            type: "collaboration.error",
            code: "YJS_SYNC_FAILED",
            fileId,
            message: "Failed to synchronize file"
        });
    }
}

async function handleYjsUpdate(socket, message) {
    if (!socket.collaboration) return;

    const { projectId } = socket.collaboration;

    const fileId = message.payload?.fileId;
    const encodedUpdate = message.payload?.update;

    if (!fileId) {
        sendJson(socket, {
            type: "collaboration.error",
            code: "FILE_ID_REQUIRED",
            message: "fileId is required"
        });
        return;
    }

    if (typeof encodedUpdate !== "string") {
        sendJson(socket, {
            type: "collaboration.error",
            code: "YJS_UPDATE_REQUIRED",
            message: "Yjs update is required"
        });
        return;
    }

    try {
        const result = await loadFileIntoYjs(projectId, fileId);

        if (!result) {
            sendJson(socket, {
                type: "collaboration.error",
                code: "FILE_NOT_FOUND",
                fileId,
                message: "File does not belong to this project"
            });
            return;
        }

        /*
         * The socket is passed as the transaction origin. The document's
         * "update" listener (yjsDocumentManager) broadcasts the change to
         * every other collaborator and skips this socket.
         */
        applyDocumentUpdate(
            result.document,
            decodeDocumentUpdate(encodedUpdate),
            socket
        );
    } catch (error) {
        logger.error(
            { fileId, error: error.message },
            "Failed to apply Yjs update"
        );

        sendJson(socket, {
            type: "collaboration.error",
            code: "YJS_UPDATE_FAILED",
            fileId,
            message: "Failed to apply Yjs update"
        });
    }
}

function handleSocketClose(socket) {
    if (!socket.collaboration) {
        return;
    }

    const { userId, user, roomId } = socket.collaboration;

    const roomSize = leaveRoom(roomId, socket);

    logger.info(
        { userId, roomId, roomSize },
        "Collaboration WebSocket disconnected"
    );

    broadcastToRoom(roomId, {
        type: "collaboration.user_left",
        user: {
            id: userId,
            name: user.name
        },
        roomSize
    });
}

export { COLLABORATION_PATH };