import { createTool } from "./toolContract.js";
import {
    getProjectFiles,
    updateProjectFile
} from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";

export const insertInFileTool = createTool({
    name: "insert_in_file",

    description:
        "Insert text before or after one exact occurrence of an anchor in an existing project file.",

    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description:
                    "The project-relative path of the file to edit."
            },

            anchor: {
                type: "string",
                description:
                    "The exact existing text to use as the insertion anchor."
            },

            content: {
                type: "string",
                description:
                    "The text to insert before or after the anchor."
            },

            position: {
                type: "string",
                enum: [
                    "before",
                    "after"
                ],
                description:
                    "Whether to insert the content before or after the anchor."
            }
        },

        required: [
            "path",
            "anchor",
            "content",
            "position"
        ],

        additionalProperties: false
    },

    async execute(input, context) {
        if (!context?.projectId) {
            const error = new Error(
                "Project ID is required to insert text in files"
            );

            error.code = "PROJECT_ID_REQUIRED";

            throw error;
        }

        if (!input?.path) {
            const error = new Error(
                "File path is required"
            );

            error.code = "FILE_PATH_REQUIRED";

            throw error;
        }

        if (typeof input.anchor !== "string") {
            const error = new Error(
                "anchor must be a string"
            );

            error.code = "INVALID_ANCHOR";

            throw error;
        }

        if (typeof input.content !== "string") {
            const error = new Error(
                "content must be a string"
            );

            error.code = "INVALID_INSERT_CONTENT";

            throw error;
        }

        if (
            input.position !== "before" &&
            input.position !== "after"
        ) {
            const error = new Error(
                "position must be either 'before' or 'after'"
            );

            error.code = "INVALID_INSERT_POSITION";

            throw error;
        }

        const path = validateProjectPath(input.path);

        const files = await getProjectFiles(
            context.projectId
        );

        const file = files.find(
            (item) => item.path === path
        );

        if (!file) {
            const error = new Error(
                `File not found: ${path}`
            );

            error.code = "FILE_NOT_FOUND";

            throw error;
        }

        if (input.anchor === "") {
            const error = new Error(
                "anchor cannot be empty"
            );

            error.code = "EMPTY_ANCHOR";

            throw error;
        }

        const firstIndex =
            file.content.indexOf(input.anchor);

        if (firstIndex === -1) {
            const error = new Error(
                `The specified anchor was not found in ${path}`
            );

            error.code = "ANCHOR_NOT_FOUND";

            throw error;
        }

        const secondIndex =
            file.content.indexOf(
                input.anchor,
                firstIndex + input.anchor.length
            );

        if (secondIndex !== -1) {
            const error = new Error(
                `The specified anchor occurs multiple times in ${path}. Provide a more specific anchor.`
            );

            error.code = "ANCHOR_NOT_UNIQUE";

            throw error;
        }

        const insertionIndex =
            input.position === "before"
                ? firstIndex
                : firstIndex + input.anchor.length;

        const updatedContent =
            file.content.slice(0, insertionIndex) +
            input.content +
            file.content.slice(insertionIndex);

        const updatedFile =
            await updateProjectFile({
                projectId: context.projectId,
                fileId: file.id,
                content: updatedContent
            });

        if (!updatedFile) {
            const error = new Error(
                `File could not be updated: ${path}`
            );

            error.code = "FILE_UPDATE_FAILED";

            throw error;
        }

        return {
            success: true,
            path: updatedFile.path,
            anchor: input.anchor,
            inserted: input.content,
            position: input.position,
            updatedAt: updatedFile.updatedAt
        };
    }
});