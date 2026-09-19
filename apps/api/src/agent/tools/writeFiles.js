import { createTool } from "./toolContract.js";
import { upsertProjectFile } from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";

export const writeFileTool =
    createTool({
        name: "write_file",

        description:
            "Create a new file or replace the complete contents of an existing file in the current project.",

        inputSchema: {
            type: "object",

            properties: {
                path: {
                    type: "string",
                    description:
                        "The project-relative path of the file to create or update."
                },

                content: {
                    type: "string",
                    description:
                        "The complete new contents of the file."
                }
            },

            required: ["path", "content"],

            additionalProperties: false
        },

        async execute(input, context) {
            if (!context?.projectId) {
                const error = new Error(
                    "Project ID is required to write files"
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

            const file = await upsertProjectFile({
                projectId: context.projectId,
                path,
                content: input.content
            });

            return {
                success: true,
                file: {
                    id: file.id,
                    path: file.path,
                    updatedAt: file.updatedAt
                }
            };
        }
    });