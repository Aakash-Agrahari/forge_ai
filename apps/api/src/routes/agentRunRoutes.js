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
    getConversationAgentRuns,
    getAgentRunEvents,
    cancelAgentRun
} from "../services/agentRunService.js";

import {
    getConversationMessages
} from "../services/messageService.js";

import { runAgent } from "../agent/agentOrchestrator.js";

const router = Router();

router.use(requireAuth);


// ============================================================
// CREATE AND EXECUTE AGENT RUN
// ============================================================

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

            const messages = await getConversationMessages(
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

            let run;

            try {
                run = await createAgentRun({
                    conversationId: req.params.conversationId
                });
            } catch (error) {
                if (error.code === "AGENT_RUN_ALREADY_ACTIVE") {
                    return res.status(409).json({
                        success: false,
                        error: {
                            code: "AGENT_RUN_ALREADY_ACTIVE",
                            message:
                                "An agent run is already active for this conversation.",
                            runId: error.runId
                        }
                    });
                }

                throw error;
            }

            runAgent({
                runId: run.id,
                projectId: req.params.projectId,
                conversationId: req.params.conversationId,
                messages
            }).catch((error) => {
                console.error(
                    `Agent run ${run.id} failed:`,
                    error
                );
            });

            return res.status(202).json({
                success: true,
                run: {
                    id: run.id,
                    conversationId: run.conversationId,
                    status: run.status,
                    phase: run.phase,
                    iteration: run.iteration,
                    toolCount: run.toolCount,
                    currentTool: run.currentTool
                }
            });
        } catch (error) {
            next(error);
        }
    }
);


// ============================================================
// LIST AGENT RUNS
// ============================================================

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

            const runs = await getConversationAgentRuns(
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


// ============================================================
// GET ONE AGENT RUN
// ============================================================

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

            const run = await getAgentRun(req.params.runId);

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


// ============================================================
// GET AGENT RUN EVENTS
// ============================================================

router.get(
    "/:projectId/conversations/:conversationId/runs/:runId/events",
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

            const run = await getAgentRun({
                runId: req.params.runId,
                conversationId: req.params.conversationId
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

            const events = await getAgentRunEvents(req.params.runId);

            return res.status(200).json({
                success: true,
                runId: req.params.runId,
                events
            });
        } catch (error) {
            next(error);
        }
    }
);


// ============================================================
// CANCEL AGENT RUN
// ============================================================

router.post(
    "/:projectId/conversations/:conversationId/runs/:runId/cancel",
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

            const run = await getAgentRun({
                runId: req.params.runId,
                conversationId: req.params.conversationId
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

            const cancelledRun = await cancelAgentRun(
                req.params.runId
            );

            return res.status(200).json({
                success: true,
                run: cancelledRun
            });
        } catch (error) {
            next(error);
        }
    }
);


export default router;