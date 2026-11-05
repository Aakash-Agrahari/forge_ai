
import crypto from "node:crypto";
import env from "../config/env.js";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

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

// Retrieve Google's authenticated user profile.
export async function getGoogleUserProfile(accessToken) {
    const response = await fetch(GOOGLE_USERINFO_URL, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error("Failed to retrieve Google user profile");
    }

    const profile = await response.json();

    if (
        !profile.sub ||
        !profile.email ||
        profile.email_verified !== true
    ) {
        throw new Error("Google account identity could not be verified");
    }

    return {
        googleId: profile.sub,
        email: profile.email,
        name: profile.name || profile.email.split("@")[0]
    };
}
