import {z} from "zod";

export const createConversationSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, "Conversation title is required")
        .max(200, "Convesation title is too long")
        .optional()
});

export const createMessageSchema = z.object({
    content: z
        .string()
        .trim()
        .min(1, "Message content is required")
        .max(50_000, "Message content is too long"),
    
    rule: z
        .enum(["user", "assistant"])
        .default("user")    
});