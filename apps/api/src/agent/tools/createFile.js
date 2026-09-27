import { createTool } from "./toolContract.js";
import {getProjectFiles, createProjectFile} from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";

export const createFileTool = createTool({
    name: "create_file",

    description:
        "Create a new file in the current project. Fails if the file already exists.",

    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description:
                    "The project-relative path of the new file to create."
            },

            content: {
                type: "string",
                description:
                    "The complete contents of the new file."
            }
        },

        required: [
            "path",
            "content"
        ],

        additionalProperties: false
    },

    async execute(input, context) {
        if (!context?.projectId) {
            const error = new Error(
                "Project ID is required to create files"
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

        if (typeof input.content !== "string") {
            const error = new Error(
                "File content must be a string"
            );

            error.code = "INVALID_FILE_CONTENT";

            throw error;
        }

        const path = validateProjectPath(input.path);

        const files = await getProjectFiles(
            context.projectId
        );

        const existingFile = files.find(
            (file) => file.path === path
        );

        if (existingFile) {
            const error = new Error(
                `File already exists: ${path}`
            );

            error.code = "FILE_ALREADY_EXISTS";

            throw error;
        }

        const createdFile = await createProjectFile({
            projectId: context.projectId,
            path,
            content: input.content
        });

        if (!createdFile) {
            const error = new Error(
                `File could not be created: ${path}`
            );

            error.code = "FILE_CREATE_FAILED";

            throw error;
        }

        return {
            success: true,
            path: createdFile.path,
            created: true,
            contentLength: input.content.length,
            createdAt: createdFile.createdAt
        };
    }
});