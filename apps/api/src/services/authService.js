import prisma from "../config/prisma.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import {
    generateSessionToken,
    hashSessionToken,
    getSessionExpiration
} from "../utils/session.js";

export async function registerUser({name, email, password}){
    const existingUser = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if(existingUser){
        const error = new Error("Unable to create account");
        error.statusCode = 409;
        error.code = "EMAIL_ALREADY_EXISTS";
        throw error;
    }

    const passwordHash = await hashPassword(password);
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiration();

    const result = await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
            data: {
                name,
                email,
                passwordHash
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
            }
        });

        await transaction.session.create({
            data: {
                tokenHash,
                userId: user.id,
                expiresAt
            }
        });
        return user;
    });

    return{
        user: result,
        sessionToken
    };
}

export async function loginUser({email, password}){
    const user = await prisma.user.findUnique({
        where: {email}
    });

    if(!user){
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        error.code = "INVALID_CREDENTIALS";
        throw error;
    }

    const passwordValid = user.passwordHash
            ? await verifyPassword(user.passwordHash, password)
            : false;

    if(!passwordValid){
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        error.code = "INVALID_CREDENTIALS";
        throw error;
    }

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiration();

    const session = await prisma.session.create({
        data: {
            tokenHash,
            userId: user.id,
            expiresAt
        }
    });

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt
        },
        sessionToken
    };
}


export async function loginOrRegisterGoogleUser({
    googleId,
    email,
    name
}) {
    // First, check whether this Google account already exists.
    let user = await prisma.user.findUnique({
        where: { googleId }
    });

    if (!user) {
        // Check whether the email belongs to an existing account.
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            const error = new Error(
                "An account with this email already exists. Please log in using your password first."
            );

            error.statusCode = 409;
            error.code = "ACCOUNT_ALREADY_EXISTS";

            throw error;
        }

        // Create a new Google-based ForgeAI account.
        user = await prisma.user.create({
            data: {
                name,
                email,
                googleId,
                passwordHash: null
            }
        });
    }

    // Create a ForgeAI session.
    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const expiresAt = getSessionExpiration();

    await prisma.session.create({
        data: {
            tokenHash,
            userId: user.id,
            expiresAt
        }
    });

    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt
        },
        sessionToken
    };
}
