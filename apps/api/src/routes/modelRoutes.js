import { Router } from "express";

import requireAuth from "../middleware/auth.js";

import {
    getAvailableProviders,
    selectProvider
} from "../llm/modelRouter.js";

const router = Router();

router.use(requireAuth);

router.get("/providers", (req, res) => {
    const availableProviders = getAvailableProviders();

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

export default router;