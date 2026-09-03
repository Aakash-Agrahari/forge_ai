import {z} from "zod";

export const createFileSchema = z.object({
    path: z
        .string()
        .trim()
        .min(1, "File path is required")
        .max(500, "File pat is too long"),

    content: z
        .string()
        .max(1_000_000, "File content is too large")
});

export const updateFileSchema = z.object({
    content: z
        .string()
        .max(1_000_000, "File content is too large")
});