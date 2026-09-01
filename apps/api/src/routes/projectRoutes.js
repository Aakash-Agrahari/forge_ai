import {Router} from "express";
import requireAuth from "../middleware/auth.js";
import {createProjectSchema} from "../validators/projectValidator.js";
import {createProject, getUserProjects} from "../services/projectService.js";

const router = Router();

router.use(requireAuth);

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

export default router;