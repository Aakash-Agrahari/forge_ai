import { Router } from "express";

import requireAuth from "../middleware/auth.js";

import {
    getProjectById
} from "../services/projectService.js";

import {
    getConversation
} from "../services/conversationService.js";

import {
    createAgentRun,
    getAgentRun,
    getConversationAgentRuns
} from "../services/agentRunService.js";

import {
    getConversationMessages
} from "../services/messageService.js";

import { runAgent } from "../agent/agentOrchestrator.js";

const router = Router();

router.use(requireAuth);

// Create and execute agent run
router.post(
    "/:projectId/conversations/:conversationId/runs",
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
                await getConversationMessages(
                    req.params.conversationId
                );

            if (messages.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: "EMPTY_CONVERSATION",
                        message:
                            "Conversation must contain at least one message before starting an agent run"
                    }
                });
            }

            const run = await createAgentRun({
                conversationId:
                    req.params.conversationId
            });

            const result = await runAgent({
                runId: run.id,
                projectId: req.params.projectId,
                conversationId:
                    req.params.conversationId,
                messages
            });

            return res.status(201).json({
                success: true,
                run: result.state,
                result: result.result
            });
        } catch (error) {
            next(error);
        }
    }
);

// List agent runs
router.get(
    "/:projectId/conversations/:conversationId/runs",
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
                conversationId:
                    req.params.conversationId,
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

            const runs =
                await getConversationAgentRuns(
                    req.params.conversationId
                );

            return res.status(200).json({
                success: true,
                runs
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get one agent run
router.get(
    "/:projectId/conversations/:conversationId/runs/:runId",
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
                conversationId:
                    req.params.conversationId,
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

            const run = await getAgentRun({
                runId: req.params.runId,
                conversationId:
                    req.params.conversationId
            });

            if (!run) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: "AGENT_RUN_NOT_FOUND",
                        message: "Agent run not found"
                    }
                });
            }

            return res.status(200).json({
                success: true,
                run
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;