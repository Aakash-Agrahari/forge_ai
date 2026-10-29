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

        logger.info(
            {
                roomId
            },
            "Collaboration room removed"
        );

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

export function broadcastToRoom(
    roomId,
    message,
    excludeSocket = null
) {
    const room = rooms.get(roomId);

    if (!room) {
        return;
    }

    const payload =
        typeof message === "string"
            ? message
            : JSON.stringify(message);

    for (const socket of room) {
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
                    roomId,
                    userId:
                        socket.collaboration?.userId,
                    error: error.message
                },
                "Failed to broadcast collaboration message"
            );
        }
    }
}

export function getActiveRoomCount() {
    return rooms.size;
}