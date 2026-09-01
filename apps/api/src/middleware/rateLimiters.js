import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
    windowMs: 15*60*1000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: "RATE_LIMITED",
            message: "Too many authentication requests. Please try again later"
        }
    }
})