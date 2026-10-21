import express from "express";
import multer from "multer"; //for handling file uploads

import requireAuth from "../middleware/auth.js";
import { getProjectById } from "../services/projectService.js";
import { getProjectFiles } from "../services/fileService.js";
import {
    importProjectArchive,
    exportProjectArchive
} from "../services/projectArchiveService.js";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        const isZip =
            file.mimetype === "application/zip" ||
            file.mimetype === "application/x-zip-compressed" ||
            file.originalname.toLowerCase().endsWith(".zip");

        if (!isZip) {
            return callback(
                new Error("Only ZIP files are allowed.")
            );
        }

        callback(null, true);
    }
});

router.use(requireAuth);

/**
 * POST /api/v1/projects/import
 *
 * Imports a ZIP archive into a newly created ForgeAI project.
 */
router.post(
    "/import",
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "ZIP file is required."
                });
            }

            const projectName =
                typeof req.body?.name === "string" &&
                req.body.name.trim()
                    ? req.body.name.trim()
                    : req.file.originalname
                        .replace(/\.zip$/i, "")
                        .trim() || "Imported Project";

            const { createProject } =
                await import("../services/projectService.js");

            const project = await createProject({
                userId: req.user.id,
                name: projectName,
                description: "Imported from ZIP"
            });

            try {
                const result = await importProjectArchive({
                    projectId: project.id,
                    buffer: req.file.buffer
                });

                return res.status(201).json({
                    success: true,
                    project,
                    ...result
                });
            } catch (error) {
                // If archive processing fails after project creation,
                // remove the empty project so the import is atomic
                // from the user's perspective.
                try {
                    const prisma = (
                        await import("../config/prisma.js")
                    ).default;

                    await prisma.project.delete({
                        where: {
                            id: project.id
                        }
                    });
                } catch (cleanupError) {
                    console.error(
                        "Failed to clean up imported project:",
                        cleanupError
                    );
                }

                throw error;
            }
        } catch (error) {
            console.error(
                "Project ZIP import error:",
                error
            );

            return res.status(400).json({
                success: false,
                message:
                    error?.message ||
                    "Failed to import project ZIP."
            });
        }
    }
);

/**
 * GET /api/v1/projects/:projectId/export
 *
 * Downloads the current ForgeAI project as a ZIP.
 */
router.get(
    "/:projectId/export",
    async (req, res) => {
        try {
            const project = await getProjectById({
                projectId: req.params.projectId,
                userId: req.user.id
            });

            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: "Project not found."
                });
            }

            const files = await getProjectFiles(
                req.params.projectId
            );

            const archiveBuffer =
                await exportProjectArchive({
                    project: {
                        ...project,
                        files
                    }
                });

            const safeProjectName = project.name
                .replace(/[^a-zA-Z0-9-_ ]/g, "")
                .trim()
                .replace(/\s+/g, "-") ||
                "forgeai-project";

            res.setHeader(
                "Content-Type",
                "application/zip"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${safeProjectName}.zip"`
            );

            res.setHeader(
                "Content-Length",
                archiveBuffer.length
            );

            return res.send(archiveBuffer);
        } catch (error) {
            console.error(
                "Project ZIP export error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    error?.message ||
                    "Failed to export project ZIP."
            });
        }
    }
);

export default router;