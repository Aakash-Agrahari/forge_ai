import logger from "../utils/logger.js";

const rooms = new Map();

export function joinRoom(roomId, socket) {
    if (!roomId || !socket) {
        return;
    }

    let room = rooms.get(roomId);

    if (!room) {
        room = new Set();
        rooms.set(roomId, room);
    }

    room.add(socket);

    logger.info(
        {
            roomId,
            userId: socket.collaboration?.userId,
            connections: room.size
        },
        "User joined collaboration room"
    );

    return room.size;
}

export function leaveRoom(roomId, socket) {
    if (!roomId || !socket) {
        return;
    }

    const room = rooms.get(roomId);

    if (!room) {
        return 0;
    }

    room.delete(socket);

    if (room.size === 0) {
        rooms.delete(roomId);

        logger.info({ roomId }, "Collaboration room removed");

        return 0;
    }

    logger.info(
        {
            roomId,
            userId: socket.collaboration?.userId,
            connections: room.size
        },
        "User left collaboration room"
    );

    return room.size;
}

export function getRoomSize(roomId) {
    const room = rooms.get(roomId);

    return room?.size ?? 0;
}

export function getRoomSockets(roomId) {
    const room = rooms.get(roomId);

    if (!room) {
        return [];
    }

    return [...room];
}

function sendToSockets(sockets, message, excludeSocket, logContext) {
    const payload =
        typeof message === "string"
            ? message
            : JSON.stringify(message);

    for (const socket of sockets) {
        if (socket === excludeSocket) {
            continue;
        }

        if (socket.readyState !== 1) {
            continue;
        }

        try {
            socket.send(payload);
        } catch (error) {
            logger.warn(
                {
                    ...logContext,
                    userId: socket.collaboration?.userId,
                    error: error.message
                },
                "Failed to broadcast collaboration message"
            );
        }
    }
}

export function broadcastToRoom(roomId, message, excludeSocket = null) {
    const room = rooms.get(roomId);

    if (!room) {
        return;
    }

    sendToSockets(room, message, excludeSocket, { roomId });
}

/*
 * Broadcast to every connected collaborator of a project.
 *
 * Used for changes that did not originate from a WebSocket client
 * (for example a REST "save" or an AI-agent file edit) so that
 * everybody's editor is updated live.
 */
export function broadcastToProject(projectId, message, excludeSocket = null) {
    for (const room of rooms.values()) {
        const sockets = [...room].filter(
            (socket) => socket.collaboration?.projectId === projectId
        );

        if (sockets.length > 0) {
            sendToSockets(sockets, message, excludeSocket, { projectId });
        }
    }
}

export function getActiveRoomCount() {
    return rooms.size;
}