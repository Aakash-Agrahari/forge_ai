import {z} from "zod";

export const createFolderSchema = z.object({
    path: z
        .string()
        .trim()
        .min(1, "Folder path is required")
        .max(500, "Folder path is too long")
});

export const renameFolderSchema = z.object({
    path: z
        .string()
        .trim()
        .min(1, "Folder path is required")
        .max(500, "Folder path is too long")
});