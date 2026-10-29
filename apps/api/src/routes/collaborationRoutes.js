import { Router } from "express";

import {
    getCollaborationRoomByToken
} from "../services/CollaborationService.js";

const router = Router();

router.get("/:shareToken", async (req, res, next) => {
    try {
        const room = await getCollaborationRoomByToken(
            req.params.shareToken
        );

        if (!room) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "COLLABORATION_NOT_FOUND",
                    message: "Collaboration link is invalid or inactive"
                }
            });
        }

        return res.status(200).json({
            success: true,
            collaboration: {
                roomId: room.id,
                projectId: room.projectId,
                project: room.project,
                isActive: room.isActive
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;