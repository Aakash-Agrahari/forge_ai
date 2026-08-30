import {z} from "zod";

export const registerSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name must not exceed 100 characters"),
    
    email: z
            .string()
            .trim()
            .toLowerCase()
            .email("Invalid email address")
            .max(254, "Email address is too long"),

    password: z
            .string()
            .min(12, "Password must be at least 12 characters")
            .max(128, "Password must not exceed 128 characters")
});

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Invalid email address")
        .max(254, "Email address is too long"),

    password: z
        .string()
        .min(1, "Password is required")
        .max(128, "Password is too long")
});