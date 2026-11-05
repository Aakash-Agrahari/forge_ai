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

const FRONTEND_URL = "http://localhost:5173" || "http://localhost:5174";

// Google OAuth login route
router.get("/google", (req, res, next) => {
    try {
        if (
            !env.googleClientId ||
            !env.googleClientSecret ||
            !env.googleRedirectUri
        ) {
            return res.status(503).json({
                success: false,
                error: {
                    code: "GOOGLE_OAUTH_NOT_CONFIGURED",
                    message: "Google login is not configured"
                }
            });
        }

        const state = generateOAuthState();
        const nonce = crypto.randomBytes(32).toString("base64url");
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);

        // Only allow redirects back to this frontend.
        let returnTo = "/";

        if (typeof req.query.returnTo === "string") {
            try {
                const destination = new URL(
                    req.query.returnTo,
                    FRONTEND_URL
                );

                if (destination.origin === new URL(FRONTEND_URL).origin) {
                    returnTo =
                        destination.pathname +
                        destination.search +
                        destination.hash;
                }
            } catch {
                returnTo = "/";
            }
        }

        const oauthCookie = createSignedOAuthCookie({
            state,
            nonce,
            codeVerifier,
            returnTo,
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        res.cookie(
            GOOGLE_OAUTH_COOKIE,
            oauthCookie,
            GOOGLE_OAUTH_COOKIE_OPTIONS
        );

        const authorizationUrl = getGoogleAuthorizationUrl({
            state,
            codeChallenge,
            nonce
        });

        return res.redirect(302, authorizationUrl);
    } catch (error) {
        next(error);
    }
});

//callback route for Google OAuth
router.get("/google/callback", async (req, res, next) => {
    try {
        const { code, state, error: googleError } = req.query;

        const oauthCookie = req.cookies?.[GOOGLE_OAUTH_COOKIE];

        // Clear the temporary OAuth cookie immediately.
        res.clearCookie(
            GOOGLE_OAUTH_COOKIE,
            {
                ...GOOGLE_OAUTH_COOKIE_OPTIONS,
                maxAge: undefined
            }
        );

        if (googleError) {
            return res.redirect(
                `${FRONTEND_URL}/?googleAuth=failed&reason=google_denied`
            );
        }

        if (
            typeof code !== "string" ||
            typeof state !== "string"
        ) {
            return res.redirect(
                `${FRONTEND_URL}/?googleAuth=failed&reason=invalid_callback`
            );
        }

        const oauthData = verifySignedOAuthCookie(oauthCookie);

        if (!oauthData) {
            return res.redirect(
                `${FRONTEND_URL}/?googleAuth=failed&reason=invalid_state`
            );
        }

        // Compare the returned state with the original state.
        const expectedState = Buffer.from(oauthData.state);
        const receivedState = Buffer.from(state);

        if (
            expectedState.length !== receivedState.length ||
            !crypto.timingSafeEqual(expectedState, receivedState)
        ) {
            return res.redirect(
                `${FRONTEND_URL}/?googleAuth=failed&reason=invalid_state`
            );
        }

        // Exchange authorization code for Google tokens.
        const tokens = await exchangeGoogleCode({
            code,
            codeVerifier: oauthData.codeVerifier
        });

        // Verify Google's ID token and nonce.
        const googleUser = await verifyGoogleIdToken({
            idToken: tokens.id_token,
            expectedNonce: oauthData.nonce
        });

        // Find or create ForgeAI user and session.
        const { user, sessionToken } =
            await loginOrRegisterGoogleUser(googleUser);

        // Establish the existing ForgeAI session.
        res.cookie(
            SESSION_COOKIE_NAME,
            sessionToken,
            getSessionCookieOptions()
        );

        // Return the user to the original frontend destination.
        const destination = new URL(
            oauthData.returnTo || "/",
            FRONTEND_URL
        );

        return res.redirect(302, destination.toString());

    } catch (error) {
        console.error("Google OAuth callback failed:", error);

        return res.redirect(
            `${FRONTEND_URL}/?googleAuth=failed&reason=authentication_failed`
        );
    }
});

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