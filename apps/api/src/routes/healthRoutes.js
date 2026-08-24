import {Router} from "express";

const router = Router();

router.get("/", (req,res) => {
    res.status(200).json({
        success: true,
        service: "forger-ai-api",
        status: "healthy",
        timestamp: new Date().toString()
    });
});

export default router;