
import crypto from "node:crypto";
import env from "../config/env.js";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const googleClient = new OAuth2Client(env.googleClientId);

// Generate a cryptographically secure random value.
export function generateOAuthState() {
    return crypto.randomBytes(32).toString("hex");
}

// Generate a PKCE code verifier.
export function generateCodeVerifier() {
    return crypto.randomBytes(32).toString("base64url");
}

// Generate a PKCE code challenge using SHA-256.
export function generateCodeChallenge(verifier) {
    return crypto
        .createHash("sha256")
        .update(verifier)
        .digest("base64url");
}

// Create the Google authorization URL.
export function getGoogleAuthorizationUrl({
    state,
    codeChallenge,
    nonce
}) {
    const params = new URLSearchParams({
        client_id: env.googleClientId,
        redirect_uri: env.googleRedirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        nonce
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// Exchange Google's authorization code for tokens.
export async function exchangeGoogleCode({
    code,
    codeVerifier
}) {
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            code,
            client_id: env.googleClientId,
            client_secret: env.googleClientSecret,
            redirect_uri: env.googleRedirectUri,
            grant_type: "authorization_code",
            code_verifier: codeVerifier
        })
    });

    if (!response.ok) {
        throw new Error("Google authorization code exchange failed");
    }

    const tokens = await response.json();

    if (!tokens.access_token || !tokens.id_token) {
        throw new Error("Google did not return the required tokens");
    }

    return tokens;
}

export async function verifyGoogleIdToken({
    idToken,
    expectedNonce
}) {
    if (!idToken || !expectedNonce) {
        throw new Error("Missing Google ID token or nonce");
    }

    const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.googleClientId
    });

    const payload = ticket.getPayload();

    if (!payload) {
        throw new Error("Invalid Google ID token");
    }

    // Verify the nonce to protect against token replay.
    if (payload.nonce !== expectedNonce) {
        throw new Error("Google ID token nonce validation failed");
    }

    // Verify the user's identity information.
    if (
        !payload.sub ||
        !payload.email ||
        payload.email_verified !== true
    ) {
        throw new Error("Google account identity could not be verified");
    }

    return {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split("@")[0]
    };
}