import { createTool } from "./toolContract.js";
import {getProjectFiles, createProjectFile} from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";

export const copyFileTool = createTool({
    name: "copy_file",

    description:
        "Copy an existing file to a new project-relative path while preserving the original file.",

    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description:
                    "The project-relative path of the existing file to copy."
            },

            newPath: {
                type: "string",
                description:
                    "The new project-relative path for the copied file."
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
                "Project ID is required to copy files"
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

        const sourceFile = files.find(
            (item) => item.path === path
        );

        if (!sourceFile) {
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

        const copiedFile = await createProjectFile({
            projectId: context.projectId,
            path: newPath,
            content: sourceFile.content
        });

        if (!copiedFile) {
            const error = new Error(
                `File could not be copied: ${path}`
            );

            error.code = "FILE_COPY_FAILED";

            throw error;
        }

        return {
            success: true,
            sourcePath: path,
            destinationPath: newPath,
            copied: true,
            updatedAt: copiedFile.updatedAt
        };
    }
});