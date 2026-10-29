import prisma from "../config/prisma.js";
import { hashSessionToken } from "../utils/session.js";
import { SESSION_COOKIE_NAME } from "../config/auth.js";

function getCookieValue(cookieHeader, cookieName) {
    if (!cookieHeader) {
        return null;
    }

    const cookies = cookieHeader.split(";");

    for (const cookie of cookies) {
        const separatorIndex = cookie.indexOf("=");

        if (separatorIndex === -1) {
            continue;
        }

        const name = cookie
            .slice(0, separatorIndex)
            .trim();

        if (name !== cookieName) {
            continue;
        }

        const value = cookie
            .slice(separatorIndex + 1)
            .trim();

        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }

    return null;
}

export async function authenticateCollaborationRequest(
    request
) {
    const sessionToken = getCookieValue(
        request.headers.cookie,
        SESSION_COOKIE_NAME
    );

    if (!sessionToken) {
        return {
            authenticated: false,
            code: "UNAUTHENTICATED",
            message: "Authentication required"
        };
    }

    const tokenHash = hashSessionToken(
        sessionToken
    );

    const session = await prisma.session.findUnique({
        where: {
            tokenHash
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    createdAt: true
                }
            }
        }
    });

    if (!session) {
        return {
            authenticated: false,
            code: "UNAUTHENTICATED",
            message: "Invalid session"
        };
    }

    if (session.revokedAt) {
        return {
            authenticated: false,
            code: "SESSION_REVOKED",
            message: "Session is no longer valid"
        };
    }

    if (session.expiresAt <= new Date()) {
        await prisma.session.update({
            where: {
                id: session.id
            },
            data: {
                revokedAt: new Date()
            }
        });

        return {
            authenticated: false,
            code: "SESSION_EXPIRED",
            message: "Session has expired"
        };
    }

    return {
        authenticated: true,
        user: session.user,
        session
    };
}