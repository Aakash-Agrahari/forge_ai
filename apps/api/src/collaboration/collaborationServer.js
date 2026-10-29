import { WebSocketServer } from "ws";

import logger from "../utils/logger.js";

import {
    authenticateCollaborationRequest
} from "./collaborationAuth.js";

import {
    getCollaborationRoomByToken
} from "../services/CollaborationService.js";

const COLLABORATION_PATH =
    "/ws/collaboration";

export function createCollaborationServer(server) {
    const wss = new WebSocketServer({
        server,
        path: COLLABORATION_PATH
    });

    wss.on("connection", async (socket, request) => {
        try {
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

            const authentication =
                await authenticateCollaborationRequest(
                    request
                );

            if (!authentication.authenticated) {
                logger.warn(
                    {
                        code: authentication.code
                    },
                    "Collaboration WebSocket authentication failed"
                );

                socket.close(
                    1008,
                    authentication.message
                );

                return;
            }

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

            socket.collaboration = {
                userId: authentication.user.id,
                user: authentication.user,
                roomId: room.id,
                projectId: room.projectId
            };

            logger.info(
                {
                    userId: authentication.user.id,
                    roomId: room.id,
                    projectId: room.projectId
                },
                "Authenticated collaboration WebSocket connected"
            );

            socket.send(
                JSON.stringify({
                    type: "collaboration.authenticated",
                    user: {
                        id: authentication.user.id,
                        name: authentication.user.name
                    },
                    room: {
                        id: room.id,
                        projectId: room.projectId
                    }
                })
            );
        } catch (error) {
            logger.error(
                {
                    error: error.message
                },
                "Collaboration WebSocket authentication error"
            );

            socket.close(
                1011,
                "Collaboration authentication failed"
            );
        }

        socket.on("close", () => {
            if (socket.collaboration) {
                logger.info(
                    {
                        userId:
                            socket.collaboration.userId,
                        roomId:
                            socket.collaboration.roomId,
                        projectId:
                            socket.collaboration.projectId
                    },
                    "Collaboration WebSocket disconnected"
                );
            }
        });

        socket.on("error", (error) => {
            logger.warn(
                {
                    error: error.message
                },
                "Collaboration WebSocket error"
            );
        });
    });

    logger.info(
        {
            path: COLLABORATION_PATH
        },
        "ForgeAI collaboration WebSocket server initialized"
    );

    return wss;
}

export {
    COLLABORATION_PATH
};