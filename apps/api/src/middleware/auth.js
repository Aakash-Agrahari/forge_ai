import prisma from "../config/prisma.js";
import {hashSessionToken} from "../utils/session.js";
import {SESSION_COOKIE_NAME} from "../config/auth.js";

export default async function requireAuth(req, res, next){
    try{
        const sessionToken = req.cookies?.[SESSION_COOKIE_NAME];

        if(!sessionToken){
            return res.status(401).json({
                success: false,
                error: {
                    code: "UNAUTHENTICATED",
                    message: "Authentication required"
                }
            });
        }

        const tokenHash = hashSessionToken(sessionToken);

        const session = await prisma.session.findUnique({
            where: {
                tokenHash
            },
            include: {
                user: {
                    select: {
                        id:true,
                        name: true,
                        email: true,
                        createdAt: true
                    }
                }
            }
        });

        if(!session){
            return res.status(401).json({
                success: false,
                error: {
                    code: "UNAUTHENTICATED",
                    message: "Authenticated required"
                }
            });
        }

        if(session.revokedAt){
            return res.status(401).json({
                success: false,
                error:{
                    code: "SESSION_REVOKED",
                    message: "Session is no longer valid"
                }
            });
        }

        if(session.expiresAt <= new Date()){
            await prisma.session.update({
                where: {
                    id: session.id
                },
                data: {
                    revokedAt: new Date()
                }
            });

            return res.status(401).json({
                success: false,
                error: {
                    code: "SESSION_EXPIRED",
                    message: "Session has expired"
                }
            });
        }

        req.user = session.user;
        req.session = session;

        next();
    } catch (error){
        next(error);
    }
}