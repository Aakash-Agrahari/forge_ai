import { z } from "zod";

export const createProjectSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Project name is required")
        .max(100, "Project name is too long"),

    description: z
        .string()
        .trim()
        .max(500, "Description is too long")
        .optional()
});

export const updateProjectSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Project name is required")
        .max(100, "Project name is too long")
        .optional(),

    description: z
        .string()
        .trim()
        .max(500, "Description is too long")
        .optional()
}).refine(
    (data) => Object.keys(data).length > 0,
    {
        message: "At least one field must be provided"
    }
);