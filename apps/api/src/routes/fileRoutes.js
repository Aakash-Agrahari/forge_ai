import { Router } from "express";

import requireAuth from "../middleware/auth.js";

import {
    createFileSchema,
    updateFileSchema
} from "../validators/fileValidator.js";

import {
    getProjectById
} from "../services/projectService.js";

import {
    createProjectFile,
    getProjectFiles,
    getProjectFile,
    updateProjectFile,
    deleteProjectFile
} from "../services/fileService.js";

const router = Router();

router.use(requireAuth);

// Create file
router.post("/:projectId/files", async (req, res, next) => {
    try {
        const project = await getProjectById({
            projectId: req.params.projectId,
            userId: req.user.id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "PROJECT_NOT_FOUND",
                    message: "Project not found"
                }
            });
        }

        const validationResult =
            createFileSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid file data",
                    details: validationResult.error.issues.map((issue) => ({
                        field: issue.path.join("."),
                        message: issue.message
                    }))
                }
            });
        }

        const file = await createProjectFile({
            projectId: req.params.projectId,
            ...validationResult.data
        });

        return res.status(201).json({
            success: true,
            file
        });
    } catch (error) {
        next(error);
    }
});

// List project files
router.get("/:projectId/files", async (req, res, next) => {
    try {
        const project = await getProjectById({
            projectId: req.params.projectId,
            userId: req.user.id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "PROJECT_NOT_FOUND",
                    message: "Project not found"
                }
            });
        }

        const files = await getProjectFiles(req.params.projectId);

        return res.status(200).json({
            success: true,
            files
        });
    } catch (error) {
        next(error);
    }
});

// Get single file
router.get("/:projectId/files/:fileId", async (req, res, next) => {
    try {
        const project = await getProjectById({
            projectId: req.params.projectId,
            userId: req.user.id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "PROJECT_NOT_FOUND",
                    message: "Project not found"
                }
            });
        }

        const file = await getProjectFile({
            projectId: req.params.projectId,
            fileId: req.params.fileId
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "FILE_NOT_FOUND",
                    message: "File not found"
                }
            });
        }

        return res.status(200).json({
            success: true,
            file
        });
    } catch (error) {
        next(error);
    }
});

// Update file
router.patch("/:projectId/files/:fileId", async (req, res, next) => {
    try {
        const project = await getProjectById({
            projectId: req.params.projectId,
            userId: req.user.id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "PROJECT_NOT_FOUND",
                    message: "Project not found"
                }
            });
        }

        const validationResult =
            updateFileSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid file data",
                    details: validationResult.error.issues.map((issue) => ({
                        field: issue.path.join("."),
                        message: issue.message
                    }))
                }
            });
        }

        const file = await updateProjectFile({
            projectId: req.params.projectId,
            fileId: req.params.fileId,
            content: validationResult.data.content
        });

        if (!file) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "FILE_NOT_FOUND",
                    message: "File not found"
                }
            });
        }

        return res.status(200).json({
            success: true,
            file
        });
    } catch (error) {
        next(error);
    }
});

// Delete file
router.delete("/:projectId/files/:fileId", async (req, res, next) => {
    try {
        const project = await getProjectById({
            projectId: req.params.projectId,
            userId: req.user.id
        });

        if (!project) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "PROJECT_NOT_FOUND",
                    message: "Project not found"
                }
            });
        }

        const deleted = await deleteProjectFile({
            projectId: req.params.projectId,
            fileId: req.params.fileId
        });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "FILE_NOT_FOUND",
                    message: "File not found"
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: "File deleted successfully"
        });
    } catch (error) {
        next(error);
    }
});

export default router;