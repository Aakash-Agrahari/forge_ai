import { createTool } from "./toolContract.js";
import {
    getProjectFiles,
    updateProjectFile
} from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";

export const moveFileTool = createTool({
    name: "move_file",

    description:
        "Move an existing file to a new project-relative path.",

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
                "Project ID is required to move files"
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
                "Source and destination paths must be different"
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

        const destinationExists = files.some(
            (item) => item.path === newPath
        );

        if (destinationExists) {
            const error = new Error(
                `Destination file already exists: ${newPath}`
            );

            error.code = "DESTINATION_EXISTS";

            throw error;
        }

        const updatedFile = await updateProjectFile({
            projectId: context.projectId,
            fileId: file.id,
            path: newPath
        });

        if (!updatedFile) {
            const error = new Error(
                `File could not be moved: ${path}`
            );

            error.code = "FILE_MOVE_FAILED";

            throw error;
        }

        return {
            success: true,
            oldPath: path,
            newPath: newPath,
            moved: true,
            updatedAt: updatedFile.updatedAt
        };
    }
});