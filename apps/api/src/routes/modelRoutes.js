import { Router } from "express";

import requireAuth from "../middleware/auth.js";
import {discoverAllModels} from "../llm/discoveryManager.js";
import {getAllModels} from "../llm/modelCatalog.js";
import { selectModels } from "../llm/modelSelector.js";
import {
    getConfiguredProviders,
    selectProvider
} from "../llm/modelRouter.js";

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

router.get("/candidates", (req, res) => {
    const models = selectModels({
        freeOnly: true,
        code: true,
        toolCalling: true
    });

    return res.status(200).json({
        success: true,
        models
    });
});

export default router;