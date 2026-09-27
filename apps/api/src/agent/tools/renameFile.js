import { createTool } from "./toolContract.js";
import {getProjectFiles, renameProjectFile} from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";

export const renameFileTool = createTool({
    name: "rename_file",

    description:
        "Rename an existing file in the current project.",

    inputSchema: {
        type: "object",

        properties: {
            path: {
                type: "string",
                description:
                    "The current project-relative path of the file."
            },

            newPath: {
                type: "string",
                description:
                    "The new project-relative path for the file."
            }
        },

        required: [
            "path",
            "newPath"
        ],

        additionalProperties: false
    },

    async execute(input, context) {
        if (!context?.projectId) {
            const error = new Error(
                "Project ID is required to rename files"
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

        if (!input?.newPath) {
            const error = new Error(
                "New file path is required"
            );

            error.code = "NEW_FILE_PATH_REQUIRED";

            throw error;
        }

        const path = validateProjectPath(input.path);
        const newPath = validateProjectPath(input.newPath);

        if (path === newPath) {
            const error = new Error(
                "New file path must be different from the current path"
            );

            error.code = "SAME_FILE_PATH";

            throw error;
        }

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

        const existingTarget = files.find(
            (item) => item.path === newPath
        );

        if (existingTarget) {
            const error = new Error(
                `A file already exists at: ${newPath}`
            );

            error.code = "TARGET_FILE_ALREADY_EXISTS";

            throw error;
        }

        const renamedFile = await renameProjectFile({
            projectId: context.projectId,
            fileId: file.id,
            path: newPath
        });

        if (!renamedFile) {
            const error = new Error(
                `File could not be renamed: ${path}`
            );

            error.code = "FILE_RENAME_FAILED";

            throw error;
        }

        return {
            success: true,
            oldPath: path,
            newPath: renamedFile.path,
            renamed: true,
            updatedAt: renamedFile.updatedAt
        };
    }
});