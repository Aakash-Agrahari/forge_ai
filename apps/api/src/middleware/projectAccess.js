import { getProjectById } from "../services/projectService.js";
import {
    getCollaborationAccess,
} from "../services/CollaborationService.js";

export async function requireProjectAccess(
    req,
    res,
    next
) {
    try {
        const projectId =
            req.params.projectId ||
            req.params.id;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "PROJECT_ID_REQUIRED",
                    message: "Project ID is required",
                },
            });
        }

        // Normal project owner access
        const ownedProject =
            await getProjectById({
                projectId,
                userId: req.user.id,
            });

        if (ownedProject) {
            req.projectAccess = {
                type: "owner",
                project: ownedProject,
            };

            return next();
        }

        // Collaboration access
        const shareToken =
            req.headers["x-collaboration-token"];

        if (!shareToken) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "PROJECT_NOT_FOUND",
                    message: "Project not found",
                },
            });
        }

        const collaboration =
            await getCollaborationAccess({
                projectId,
                shareToken,
            });

        if (!collaboration) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "PROJECT_NOT_FOUND",
                    message: "Project not found",
                },
            });
        }

        req.projectAccess = {
            type: "collaborator",
            roomId: collaboration.id,
            projectId: collaboration.projectId,
            ownerId: collaboration.ownerId,
        };

        return next();
    } catch (error) {
        next(error);
    }
}