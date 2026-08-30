import prisma from "../config/prisma.js";
import { hashPassword } from "../utils/password.js";
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