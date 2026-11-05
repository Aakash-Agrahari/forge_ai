import {Router} from "express";
import {registerSchema, loginSchema} from "../validators/authValidator.js";
import {registerUser, loginUser} from "../services/authService.js";
import requireAuth from "../middleware/auth.js";
import prisma from "../config/prisma.js";
import {SESSION_COOKIE_NAME, getSessionCookieOptions, getSessionClearCookieOptions} from "../config/auth.js";
import {authRateLimiter} from "../middleware/rateLimiters.js";
import crypto from "node:crypto";
import env from "../config/env.js";
import {
    generateOAuthState,
    generateCodeVerifier,
    generateCodeChallenge,
    getGoogleAuthorizationUrl,
    exchangeGoogleCode,
    verifyGoogleIdToken
} from "../services/googleOAuthService.js";

import { loginOrRegisterGoogleUser } from "../services/authService.js";

const router = Router();

const GOOGLE_OAUTH_COOKIE = "forgeai_google_oauth";

const GOOGLE_OAUTH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: 10 * 60 * 1000
};

function createSignedOAuthCookie(payload) {
    const encodedPayload = Buffer
        .from(JSON.stringify(payload))
        .toString("base64url");

    const signature = crypto
        .createHmac("sha256", env.sessionSecret)
        .update(encodedPayload)
        .digest("base64url");

    return `${encodedPayload}.${signature}`;
}

function verifySignedOAuthCookie(value) {
    if (!value || typeof value !== "string") {
        return null;
    }

    const parts = value.split(".");

    if (parts.length !== 2) {
        return null;
    }

    const [encodedPayload, receivedSignature] = parts;

    const expectedSignature = crypto
        .createHmac("sha256", env.sessionSecret)
        .update(encodedPayload)
        .digest();

    let receivedBuffer;

    try {
        receivedBuffer = Buffer.from(
            receivedSignature,
            "base64url"
        );
    } catch {
        return null;
    }

    if (
        receivedBuffer.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(
            expectedSignature,
            receivedBuffer
        )
    ) {
        return null;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(encodedPayload, "base64url").toString("utf8")
        );

        if (
            !payload.state ||
            !payload.nonce ||
            !payload.codeVerifier ||
            !payload.expiresAt ||
            payload.expiresAt < Date.now()
        ) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

router.post("/register", authRateLimiter, async(req, res, next) => {
    try{
        const validationResult = registerSchema.safeParse(req.body);

        if(!validationResult.success){
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid registration data",
                    details: validationResult.error.issues.map((issue) => ({
                        field: issue.path.join("."),
                        message: issue.message
                    }))
                }
            });
        }

        const {name, email, password} = validationResult.data;

        const {user, sessionToken} = await registerUser({
            name,
            email,
            password
        });

        const isProduction = process.env.NODE_ENV === "production";

        res.cookie(
            SESSION_COOKIE_NAME,
            sessionToken,
            getSessionCookieOptions()
        );

        return res.status(201).json({
            success: true,
            user
        });

    } catch (error){
        next(error);
    }
});

router.post("/login", authRateLimiter, async(req, res, next) => {
    try {
        const validationResult = loginSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid login data",
                    details: validationResult.error.issues.map((issue) => ({
                        field: issue.path.join("."),
                        message: issue.message
                    }))
                }
            });
        }

        const { email, password } = validationResult.data;

        const { user, sessionToken } = await loginUser({
            email,
            password
        });

        const isProduction = process.env.NODE_ENV === "production";

        res.cookie(
            SESSION_COOKIE_NAME,
            sessionToken,
            getSessionCookieOptions()
        );

        return res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
});


router.post("/logout", requireAuth, async (req, res, next) => {
    try {
        await prisma.session.update({
            where: {
                id: req.session.id
            },
            data: {
                revokedAt: new Date()
            }
        });

        res.clearCookie(
            SESSION_COOKIE_NAME,
            getSessionClearCookieOptions()
        );

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        next(error);
    }
});

router.get("/me", requireAuth, async(req,res) => {
    return res.status(200).json({
        success: true,
        user: req.user
    })
});

export default router;