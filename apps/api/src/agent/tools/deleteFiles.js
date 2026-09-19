import { createTool } from "./toolContract.js";
import { deleteProjectFile } from "../../services/fileService.js";
import { validateProjectPath } from "../projectPath.js";
import { getProjectFiles } from "../../services/fileService.js";

export const deleteFileTool =
    createTool({
        name: "delete_file",

        description:
            "Delete a file from the current project.",

        inputSchema: {
            type: "object",

            properties: {
                path: {
                    type: "string",
                    description:
                        "The project-relative path of the file to delete."
                }
            },

            required: ["path"],

            additionalProperties: false
        },

        async execute(input, context) {
            if (!context?.projectId) {
                const error = new Error(
                    "Project ID is required to delete files"
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

            await deleteProjectFile({
                projectId: context.projectId,
                fileId: file.id
            });

            return {
                success: true,
                path
            };
        }
    });