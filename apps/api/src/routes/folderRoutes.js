import express from "express";

import { requireAuth } from "../middleware/authMiddleware.js";

import {
    createProjectFolder,
    getProjectFolders,
    getProjectFolder,
    renameProjectFolder,
    deleteProjectFolder
} from "../services/folderService.js";

import {
    createFolderSchema,
    renameFolderSchema
} from "../validators/folderValidator.js";

import { getProjectById } from "../services/projectService.js";

const router = express.Router();

router.use(requireAuth);

async function verifyProjectOwnership(projectId, userId) {
    const project = await getProjectById({
        projectId,
        userId
    });

    return project;
}

/*
 * GET /projects/:projectId/folders
 */
router.get("/:projectId/folders", async (req, res) => {
    try {
        const { projectId } = req.params;

        const project = await verifyProjectOwnership(
            projectId,
            req.user.id
        );

        if (!project) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const folders = await getProjectFolders(projectId);

        return res.json(folders);
    } catch (error) {
        console.error(
            "[FolderRoutes] Failed to get project folders:",
            error
        );

        return res.status(500).json({
            message: "Failed to get project folders"
        });
    }
});

/*
 * POST /projects/:projectId/folders
 */
router.post("/:projectId/folders", async (req, res) => {
    try {
        const { projectId } = req.params;

        const project = await verifyProjectOwnership(
            projectId,
            req.user.id
        );

        if (!project) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const validation =
            createFolderSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                message: "Validation failed",
                details: validation.error.issues.map(
                    (issue) => issue.message
                )
            });
        }

        const folder = await createProjectFolder({
            projectId,
            path: validation.data.path
        });

        return res.status(201).json(folder);
    } catch (error) {
        console.error(
            "[FolderRoutes] Failed to create project folder:",
            error
        );

        if (error?.code === "P2002") {
            return res.status(409).json({
                message: "A folder with this path already exists"
            });
        }

        return res.status(500).json({
            message: "Failed to create project folder"
        });
    }
});

/*
 * GET /projects/:projectId/folders/:folderId
 */
router.get(
    "/:projectId/folders/:folderId",
    async (req, res) => {
        try {
            const { projectId, folderId } = req.params;

            const project = await verifyProjectOwnership(
                projectId,
                req.user.id
            );

            if (!project) {
                return res.status(404).json({
                    message: "Project not found"
                });
            }

            const folder = await getProjectFolder({
                projectId,
                folderId
            });

            if (!folder) {
                return res.status(404).json({
                    message: "Folder not found"
                });
            }

            return res.json(folder);
        } catch (error) {
            console.error(
                "[FolderRoutes] Failed to get project folder:",
                error
            );

            return res.status(500).json({
                message: "Failed to get project folder"
            });
        }
    }
);

/*
 * PATCH /projects/:projectId/folders/:folderId
 */
router.patch(
    "/:projectId/folders/:folderId",
    async (req, res) => {
        try {
            const { projectId, folderId } = req.params;

            const project = await verifyProjectOwnership(
                projectId,
                req.user.id
            );

            if (!project) {
                return res.status(404).json({
                    message: "Project not found"
                });
            }

            const validation =
                renameFolderSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    message: "Validation failed",
                    details: validation.error.issues.map(
                        (issue) => issue.message
                    )
                });
            }

            const result = await renameProjectFolder({
                projectId,
                folderId,
                path: validation.data.path
            });

            if (result.count === 0) {
                return res.status(404).json({
                    message: "Folder not found"
                });
            }

            const folder = await getProjectFolder({
                projectId,
                folderId
            });

            return res.json(folder);
        } catch (error) {
            console.error(
                "[FolderRoutes] Failed to rename project folder:",
                error
            );

            if (error?.code === "P2002") {
                return res.status(409).json({
                    message:
                        "A folder with this path already exists"
                });
            }

            return res.status(500).json({
                message: "Failed to rename project folder"
            });
        }
    }
);

/*
 * DELETE /projects/:projectId/folders/:folderId
 */
router.delete(
    "/:projectId/folders/:folderId",
    async (req, res) => {
        try {
            const { projectId, folderId } = req.params;

            const project = await verifyProjectOwnership(
                projectId,
                req.user.id
            );

            if (!project) {
                return res.status(404).json({
                    message: "Project not found"
                });
            }

            const result = await deleteProjectFolder({
                projectId,
                folderId
            });

            if (result.count === 0) {
                return res.status(404).json({
                    message: "Folder not found"
                });
            }

            return res.status(204).send();
        } catch (error) {
            console.error(
                "[FolderRoutes] Failed to delete project folder:",
                error
            );

            return res.status(500).json({
                message: "Failed to delete project folder"
            });
        }
    }
);

export default router;