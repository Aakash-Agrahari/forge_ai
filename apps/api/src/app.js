import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";

import env from "./config/env.js";
import logger from "./utils/logger.js";
import healthRoutes from "./routes/healthRoutes.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

//Security headers
app.use(helmet());


 //CORS
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

//Health check
app.use("/api/v1/health", healthRoutes);

//404 handler
app.use(notFound);

// This is a centralized error handler and must be registered after routes.
app.use(errorHandler);

export default app;