import logger from "../utils/logger.js";

const errorHandler = (error, req, res, next) => {
    logger.error(
        {
            err: error,
            method: req.method,
            path: req.originUrl
        },
        "Unhandled application error"
    );

    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        error: {
            code: error.code || "INTERNAL_SERVER_ERROR",
            message:
                statusCode === 500
                    ? "An unexpected error has been occured."
                    : error.message
        }
    });
};

export default errorHandler;