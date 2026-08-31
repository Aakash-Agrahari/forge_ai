import {Router} from "express";
import {registerSchema, loginSchema} from "../validators/authValidator.js";
import {registerUser, loginUser} from "../services/authService.js";
import requireAuth from "./middleware/auth.js";

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

router.post("/login", async(req, res, next) => {
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

        res.cookie("forgeai_session", sessionToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            success: true,
            user
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