import {Router} from "express";
import {registerSchema} from "../validators/authValidator.js";
import {registerUser} from "../services/authService.js";

const router = Router();

router.post("/register", async(req, res, next) => {
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

        res.cookie("forgeai_session", sessionToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        return res.status(201).json({
            success: true,
            user
        });

    } catch (error){
        next(error);
    }
});

export default router;