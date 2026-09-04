import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";

import env from "./config/env.js";
import logger from "./utils/logger.js";
import healthRoutes from "./routes/healthRoutes.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import agentRunRoutes from "./routes/agentRunRoutes.js";

const app = express();

//Security headers
app.use(helmet());


 //CORS, used to control which domains can access the API. In production, you should set the origin to your frontend domain.
app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true
    })
);

//Request logging
app.use(
    pinoHttp({
        logger
    })
);

//This is Request body limits which prevents unexpectedly large JSON requests.
app.use(
    express.json({
        limit: "1mb"
    })
);

//Cookie parser middleware to parse cookies from incoming requests.
app.use(cookieParser());

//Health check
app.use("/api/v1/health", healthRoutes);

//Auth routes
app.use("/api/v1/auth", authRoutes);

//Project routes
app.use("/api/v1/projects", projectRoutes);

//File routes
app.use("/api/v1/projects", fileRoutes);

//Conversation routes
app.use("/api/v1/projects", conversationRoutes);

//Agent run routes
app.use("/api/v1/projects", agentRunRoutes);

//404 handler
app.use(notFound);

// This is a centralized error handler and must be registered after routes.
app.use(errorHandler);

export default app;