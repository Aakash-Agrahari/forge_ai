import { createTool } from "./toolContract.js";
import {
    getProjectFiles,
    updateProjectFile
} from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";

export const replaceInFileTool = createTool({
    name: "replace_in_file",

    description:
        "Replace one exact occurrence of text in an existing project file.",

    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description:
                    "The project-relative path of the file to edit."
            },

            oldText: {
                type: "string",
                description:
                    "The exact existing text to replace."
            },

            newText: {
                type: "string",
                description:
                    "The replacement text."
            }
        },

        required: [
            "path",
            "oldText",
            "newText"
        ],

        additionalProperties: false
    },

    async execute(input, context) {
        if (!context?.projectId) {
            const error = new Error(
                "Project ID is required to replace text in files"
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

        if (typeof input.oldText !== "string") {
            const error = new Error(
                "oldText must be a string"
            );

            error.code = "INVALID_OLD_TEXT";

            throw error;
        }

        if (typeof input.newText !== "string") {
            const error = new Error(
                "newText must be a string"
            );

            error.code = "INVALID_NEW_TEXT";

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

        if (input.oldText === "") {
            const error = new Error(
                "oldText cannot be empty"
            );

            error.code = "EMPTY_OLD_TEXT";

            throw error;
        }

        const firstIndex =
            file.content.indexOf(input.oldText);

        if (firstIndex === -1) {
            const error = new Error(
                `The specified text was not found in ${path}`
            );

            error.code = "TEXT_NOT_FOUND";

            throw error;
        }

        const secondIndex =
            file.content.indexOf(
                input.oldText,
                firstIndex + input.oldText.length
            );

        if (secondIndex !== -1) {
            const error = new Error(
                `The specified text occurs multiple times in ${path}. Provide a more specific oldText block.`
            );

            error.code = "TEXT_NOT_UNIQUE";

            throw error;
        }

        const updatedContent =
            file.content.slice(0, firstIndex) +
            input.newText +
            file.content.slice(
                firstIndex + input.oldText.length
            );

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
            replaced: input.oldText,
            replacement: input.newText,
            updatedAt: updatedFile.updatedAt
        };
    }
});