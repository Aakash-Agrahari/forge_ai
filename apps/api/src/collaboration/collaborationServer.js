import {WebSocketServer} from "ws";
import logger from "../utils/logger.js";

const COLLABORATION_PATH = "/ws/collaboration";

export function createCollaborationServer(server){
    const wss = new WebSocketServer({
        server,
        path: COLLABORATION_PATH
    });

    wss.on("connection", (socket, request) => {
        logger.info(
            {path: request.url},
            "Collaboration WebSocket connected"
        );

        socket.send(
            JSON.stringify({
                type: "collaboration.connected",
                message: "ForgeAI collaboration channel connected"
            })
        );

        socket.on("close", () => {
            logger.info("Collaboration WebSocket disconnected");
        });

        socket.on("error", (error) => {
            logger.warn(
                {error: error.message},
                "Collaboration WebSocket error"
            );
        });
    });

    logger.info(
        {
            path: COLLABORATION_PATH
        },
        "ForgeAI collaboration WebSocket server started"
    );
    return wss;
}

export {COLLABORATION_PATH};
