import app from "./app.js";
import env from "./config/env.js";
import logger from "./utils/logger.js";

const server = app.listen(env.port, () => {
    logger.info(
        {
            port: env.port,
            environment: env.nodeEnv
        },
        "ForgeAI API server started"
    );
});

const shutdown = (signal) => {
    logger.info({signal}, "Shutdown signal received");

    server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));