import { Router } from "express";

import requireAuth from "../middleware/auth.js";
import {discoverAllModels} from "../llm/discoveryManager.js";
import {getAllModels} from "../llm/modelCatalog.js";
import { selectModels } from "../llm/modelSelector.js";
import {getConfiguredProviders,selectProvider} from "../llm/modelRouter.js";
import { executeWithFallback } from "../llm/fallbackExecutor.js";
import { executeProvider } from "../llm/providerExecutor.js";
import {getAllModelHealth} from "../llm/modelHealth.js";

const router = Router();

router.use(requireAuth);

router.get("/providers", (req, res) => {
    const availableProviders = getConfiguredProviders();

    return res.status(200).json({
        success: true,
        providers: availableProviders.map((provider) => ({
            name: provider.name,
            models: provider.models,
            priority: provider.priority
        }))
    });
});

router.get("/selected-provider", (req, res) => {
    try {
        const provider = selectProvider();

        return res.status(200).json({
            success: true,
            provider: {
                name: provider.name,
                models: provider.models,
                priority: provider.priority
            }
        });
    } catch (error) {
        throw error;
    }
});

router.post("/discover", async (req, res, next) => {
    try{
        const results = await discoverAllModels();

        return res.status(200).json({
            success: true,
            results
        });
    } catch (error) {
        next(error);
    }
});

router.get("/catalog", (req, res) => {
    return res.status(200).json({
        success: true,
        models: getAllModels()
    });
});

router.get("/candidates", (req, res, next) => {
    try {
        const models = selectModels({
            freeOnly: true
        });

        return res.status(200).json({
            success: true,
            models
        });
    } catch (error) {
        next(error);
    }
});

router.get("/health", async (req, res, next) => {
    try {
        return res.status(200).json({
            success: true,
            models: getAllModelHealth()
        });
    } catch (error) {
        next(error);
    }
});

// This endpoint is for testing the execution of a model provider with a given message
router.post("/generate", async (req, res, next) => {
    try {
        const {
            message,
            provider,
            model
        } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message:
                        "message is required"
                }
            });
        }

        let models;

        if (provider && model) {
            models = [
                {
                    provider,
                    id: model
                }
            ];
        } else {
            models = selectModels({
                freeOnly: true,
                code: true,
                toolCalling: true
            });
        }

        const result =
            await executeWithFallback({
                models,
                messages: [
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.2,
                maxTokens: 8192
            });

        return res.status(200).json({
            success: true,
            result
        });
    } catch (error) {
        next(error);
    }
});

export default router;