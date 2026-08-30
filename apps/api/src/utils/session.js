import crypto from "node:crypto";

export function generateSessionToken(){
    return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

export function getSessionExpiration(){
    const expiration = new Date();

    expiration.setDate(expiration.getDate() + 30);

    return expiration;
}