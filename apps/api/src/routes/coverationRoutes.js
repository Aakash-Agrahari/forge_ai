import { Router } from "express";

import requireAuth from "../middleware/auth.js";

import {
    createConversationSchema,
    createMessageSchema
} from "../validators/conversationValidator.js";

import {
    getProjectById
} from "../services/projectService.js";

import {
    createConversation,
    getProjectConversations,
    getConversation,
    createMessage,
    getConversationMessages
} from "../services/conversationService.js";

const router = Router();

router.use(requireAuth);

// Create conversation
router.post("/:projectId/conversations", async (req, res, next) => {
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
            createConversationSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid conversation data",
                    details: validationResult.error.issues.map((issue) => ({
                        field: issue.path.join("."),
                        message: issue.message
                    }))
                }
            });
        }

        const conversation = await createConversation({
            projectId: req.params.projectId,
            ...validationResult.data
        });

        return res.status(201).json({
            success: true,
            conversation
        });
    } catch (error) {
        next(error);
    }
});

// List conversations
router.get("/:projectId/conversations", async (req, res, next) => {
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

        const conversations =
            await getProjectConversations(req.params.projectId);

        return res.status(200).json({
            success: true,
            conversations
        });
    } catch (error) {
        next(error);
    }
});

// Get conversation
router.get(
    "/:projectId/conversations/:conversationId",
    async (req, res, next) => {
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

            const conversation = await getConversation({
                conversationId: req.params.conversationId,
                projectId: req.params.projectId
            });

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: "CONVERSATION_NOT_FOUND",
                        message: "Conversation not found"
                    }
                });
            }

            return res.status(200).json({
                success: true,
                conversation
            });
        } catch (error) {
            next(error);
        }
    }
);

// Add message
router.post(
    "/:projectId/conversations/:conversationId/messages",
    async (req, res, next) => {
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

            const conversation = await getConversation({
                conversationId: req.params.conversationId,
                projectId: req.params.projectId
            });

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: "CONVERSATION_NOT_FOUND",
                        message: "Conversation not found"
                    }
                });
            }

            const validationResult =
                createMessageSchema.safeParse(req.body);

            if (!validationResult.success) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid message data",
                        details: validationResult.error.issues.map((issue) => ({
                            field: issue.path.join("."),
                            message: issue.message
                        }))
                    }
                });
            }

            const message = await createMessage({
                conversationId: req.params.conversationId,
                ...validationResult.data
            });

            return res.status(201).json({
                success: true,
                message
            });
        } catch (error) {
            next(error);
        }
    }
);

// List messages
router.get(
    "/:projectId/conversations/:conversationId/messages",
    async (req, res, next) => {
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

            const conversation = await getConversation({
                conversationId: req.params.conversationId,
                projectId: req.params.projectId
            });

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: "CONVERSATION_NOT_FOUND",
                        message: "Conversation not found"
                    }
                });
            }

            const messages =
                await getConversationMessages(req.params.conversationId);

            return res.status(200).json({
                success: true,
                messages
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;