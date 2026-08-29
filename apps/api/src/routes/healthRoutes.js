import { Router } from "express";
import prisma from "../config/prisma.js";

const router = Router();

router.get("/", async (req, res, next) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            success: true,
            service: "forge-ai-api",
            status: "healthy",
            database: "connected",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

export default router;