import { WebSocketServer } from "ws";

import logger from "../utils/logger.js";

import {
    authenticateCollaborationRequest
} from "./collaborationAuth.js";

import {
    getCollaborationRoomByToken
} from "../services/CollaborationService.js";

import {
    joinRoom,
    leaveRoom,
    getRoomSize,
    broadcastToRoom
} from "./collaborationRoomManager.js";

import {
    getOrCreateDocument
} from "./yjsDocumentManager.js";

import {
    loadFileIntoYjs
} from "./yjsFileService.js";

import {
    encodeDocumentState,
    applyDocumentUpdate,
    encodeDocumentUpdate,
    decodeDocumentUpdate
} from "./yjsSync.js";

const COLLABORATION_PATH =
    "/ws/collaboration";

export function createCollaborationServer(server) {
    const wss = new WebSocketServer({
        server,
        path: COLLABORATION_PATH
    });

    wss.on(
        "connection",
        async (socket, request) => {
            try {
                /*
                 * --------------------------------
                 * 1. Read share token
                 * --------------------------------
                 */

                const requestUrl = new URL(
                    request.url,
                    `http://${request.headers.host}`
                );

                const shareToken =
                    requestUrl.searchParams.get(
                        "shareToken"
                    );

                if (!shareToken) {
                    socket.close(
                        1008,
                        "Collaboration share token is required"
                    );

                    return;
                }

                /*
                 * --------------------------------
                 * 2. Authenticate user
                 * --------------------------------
                 */

                const authentication =
                    await authenticateCollaborationRequest(
                        request
                    );

                if (
                    !authentication.authenticated
                ) {
                    logger.warn(
                        {
                            code:
                                authentication.code
                        },
                        "Collaboration WebSocket authentication failed"
                    );

                    socket.close(
                        1008,
                        authentication.message
                    );

                    return;
                }

                /*
                 * --------------------------------
                 * 3. Resolve collaboration room
                 * --------------------------------
                 */

                const room =
                    await getCollaborationRoomByToken(
                        shareToken
                    );

                if (!room) {
                    logger.warn(
                        "Invalid or inactive collaboration room"
                    );

                    socket.close(
                        1008,
                        "Invalid collaboration link"
                    );

                    return;
                }

                /*
                 * --------------------------------
                 * 4. Attach collaboration metadata
                 * --------------------------------
                 */

                socket.collaboration = {
                    userId:
                        authentication.user.id,

                    user:
                        authentication.user,

                    roomId:
                        room.id,

                    projectId:
                        room.projectId
                };

                /*
                 * --------------------------------
                 * 5. Join room
                 * --------------------------------
                 */

                const roomSize = joinRoom(
                    room.id,
                    socket
                );

                logger.info(
                    {
                        userId:
                            authentication.user.id,

                        roomId:
                            room.id,

                        projectId:
                            room.projectId,

                        roomSize
                    },
                    "Authenticated collaboration WebSocket connected"
                );

                /*
                 * --------------------------------
                 * 6. Tell client authentication
                 * succeeded
                 * --------------------------------
                 */

                socket.send(
                    JSON.stringify({
                        type:
                            "collaboration.authenticated",

                        user: {
                            id:
                                authentication.user
                                    .id,

                            name:
                                authentication.user
                                    .name
                        },

                        room: {
                            id:
                                room.id,

                            projectId:
                                room.projectId
                        },

                        roomSize
                    })
                );

                /*
                 * --------------------------------
                 * 7. Notify other users
                 * --------------------------------
                 */

                broadcastToRoom(
                    room.id,
                    {
                        type:
                            "collaboration.user_joined",

                        user: {
                            id:
                                authentication.user
                                    .id,

                            name:
                                authentication.user
                                    .name
                        },

                        roomSize
                    },
                    socket
                );

                /*
                 * --------------------------------
                 * 8. Handle incoming messages
                 * --------------------------------
                 */

                socket.on(
                    "message",
                    (rawMessage) => {
                        handleRoomMessage(
                            socket,
                            rawMessage
                        );
                    }
                );
            } catch (error) {
                logger.error(
                    {
                        error:
                            error.message
                    },
                    "Collaboration WebSocket authentication error"
                );

                socket.close(
                    1011,
                    "Collaboration authentication failed"
                );

                return;
            }

            /*
             * --------------------------------
             * 9. Handle disconnect
             * --------------------------------
             */

            socket.on(
                "close",
                () => {
                    handleSocketClose(socket);
                }
            );

            /*
             * --------------------------------
             * 10. Handle socket errors
             * --------------------------------
             */

            socket.on(
                "error",
                (error) => {
                    logger.warn(
                        {
                            userId:
                                socket
                                    .collaboration
                                    ?.userId,

                            roomId:
                                socket
                                    .collaboration
                                    ?.roomId,

                            error:
                                error.message
                        },
                        "Collaboration WebSocket error"
                    );
                }
            );
        }
    );

    logger.info(
        {
            path:
                COLLABORATION_PATH
        },
        "ForgeAI collaboration WebSocket server initialized"
    );

    return wss;
}

function handleRoomMessage(
    socket,
    rawMessage
) {
    if (!socket.collaboration) {
        return;
    }

    const roomId =
        socket.collaboration.roomId;

    let message;

    try {
        message = JSON.parse(
            rawMessage.toString()
        );
    } catch {
        socket.send(
            JSON.stringify({
                type:
                    "collaboration.error",

                code:
                    "INVALID_MESSAGE",

                message:
                    "Message must be valid JSON"
            })
        );

        return;
    }

    if (
        !message ||
        typeof message.type !== "string"
    ) {
        socket.send(
            JSON.stringify({
                type:
                    "collaboration.error",

                code:
                    "INVALID_MESSAGE",

                message:
                    "Message type is required"
            })
        );

        return;
    }

    if (
        message.type ===
        "yjs.sync.request"
    ) {
        void handleYjsSyncRequest(
            socket,
            message
        );

        return;
    }

    if (
        message.type ===
        "yjs.update"
    ) {
        void handleYjsUpdate(
            socket,
            message
        );

        return;
    }

    broadcastToRoom(
        roomId,
        {
            type:
                message.type,

            payload:
                message.payload ?? null,

            sender: {
                id:
                    socket.collaboration
                        .userId,

                name:
                    socket.collaboration
                        .user.name
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
        socket.send(JSON.stringify({
            type: "collaboration.error",
            code: "FILE_ID_REQUIRED",
            message: "fileId is required"
        }));
        return;
    }

    try {
        const result = await loadFileIntoYjs(
            projectId,
            fileId
        );

        if (!result) {
            socket.send(JSON.stringify({
                type: "collaboration.error",
                code: "FILE_NOT_FOUND",
                message: "File does not belong to this project"
            }));
            return;
        }

        const state = encodeDocumentState(result.document);

        socket.send(JSON.stringify({
            type: "yjs.sync.state",
            payload: {
                fileId,
                state: encodeDocumentUpdate(state)
            }
        }));
    } catch (error) {
        socket.send(JSON.stringify({
            type: "collaboration.error",
            code: "YJS_SYNC_FAILED",
            message: "Failed to synchronize file"
        }));
    }
}

async function handleYjsUpdate(socket, message) {
    if (!socket.collaboration) return;

    const { projectId } = socket.collaboration;

    const fileId = message.payload?.fileId;
    const encodedUpdate = message.payload?.update;

    if (!fileId) {
        socket.send(JSON.stringify({
            type: "collaboration.error",
            code: "FILE_ID_REQUIRED",
            message: "fileId is required"
        }));
        return;
    }

    if (typeof encodedUpdate !== "string") {
        socket.send(JSON.stringify({
            type: "collaboration.error",
            code: "YJS_UPDATE_REQUIRED",
            message: "Yjs update is required"
        }));
        return;
    }

    try {
        const result = await loadFileIntoYjs(
            projectId,
            fileId
        );

        if (!result) {
            socket.send(JSON.stringify({
                type: "collaboration.error",
                code: "FILE_NOT_FOUND",
                message: "File does not belong to this project"
            }));
            return;
        }

        const update = decodeDocumentUpdate(encodedUpdate);

        applyDocumentUpdate(
            result.document,
            update
        );

        broadcastToRoom(
            socket.collaboration.roomId,
            {
                type: "yjs.update",
                payload: {
                    fileId,
                    update: encodedUpdate
                },
                sender: {
                    id: socket.collaboration.userId,
                    name: socket.collaboration.user.name
                }
            },
            socket
        );
    } catch (error) {
        socket.send(JSON.stringify({
            type: "collaboration.error",
            code: "YJS_UPDATE_FAILED",
            message: "Failed to apply Yjs update"
        }));
    }
}

function handleSocketClose(socket) {
    if (!socket.collaboration) {
        return;
    }

    const {
        userId,
        user,
        roomId
    } = socket.collaboration;

    const roomSize = leaveRoom(
        roomId,
        socket
    );

    logger.info(
        {
            userId,
            roomId,
            roomSize
        },
        "Collaboration WebSocket disconnected"
    );

    /*
     * Notify remaining users.
     */

    broadcastToRoom(
        roomId,
        {
            type:
                "collaboration.user_left",

            user: {
                id:
                    userId,

                name:
                    user.name
            },

            roomSize
        }
    );
}

export {
    COLLABORATION_PATH
};