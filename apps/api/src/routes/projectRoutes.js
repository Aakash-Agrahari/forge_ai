import { Router } from "express";

import requireAuth from "../middleware/auth.js";

import {
    createProjectSchema,
    updateProjectSchema
} from "../validators/projectValidator.js";

import {
    createProject,
    getUserProjects,
    getProjectById,
    updateProject,
    deleteProject
} from "../services/projectService.js";

const router = Router();

router.use(requireAuth);

// Create project
router.post("/", async (req, res, next) => {
    try {
        const validationResult =
            createProjectSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid project data",
                    details: validationResult.error.issues.map((issue) => ({
                        field: issue.path.join("."),
                        message: issue.message
                    }))
                }
            });
        }

        const project = await createProject({
            userId: req.user.id,
            ...validationResult.data
        });

        return res.status(201).json({
            success: true,
            project
        });
    } catch (error) {
        next(error);
    }
});

// List user's projects
router.get("/", async (req, res, next) => {
    try {
        const projects = await getUserProjects(req.user.id);

        return res.status(200).json({
            success: true,
            projects
        });
    } catch (error) {
        next(error);
    }
});

// Get single project
router.get("/:id", async (req, res, next) => {
    try {
        const project = await getProjectById({
            projectId: req.params.id,
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

        return res.status(200).json({
            success: true,
            project
        });
    } catch (error) {
        next(error);
    }
});

// Update project
router.patch("/:id", async (req, res, next) => {
    try {
        const validationResult =
            updateProjectSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid project data",
                    details: validationResult.error.issues.map((issue) => ({
                        field: issue.path.join("."),
                        message: issue.message
                    }))
                }
            });
        }

        const project = await updateProject({
            projectId: req.params.id,
            userId: req.user.id,
            data: validationResult.data
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

        return res.status(200).json({
            success: true,
            project
        });
    } catch (error) {
        next(error);
    }
});

// Delete project
router.delete("/:id", async (req, res, next) => {
    try {
        const deleted = await deleteProject({
            projectId: req.params.id,
            userId: req.user.id
        });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "PROJECT_NOT_FOUND",
                    message: "Project not found"
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: "Project deleted successfully"
        });
    } catch (error) {
        next(error);
    }
});

export default router;