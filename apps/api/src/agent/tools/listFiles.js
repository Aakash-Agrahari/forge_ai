import { createTool } from "./toolContract.js";
import { getProjectFiles } from "../../services/fileService.js";

export const listFilesTool =
    createTool({
        name: "list_files",
        description:
            "List all files in the current project.",
        inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false
        },

        async execute(input, context) {
            if (!context?.projectId) {
                const error = new Error(
                    "Project ID is required to list files"
                );

                error.code = "PROJECT_ID_REQUIRED";

                throw error;
            }

            const files =
                await getProjectFiles(
                    context.projectId
                );

            return {
                files: files.map((file) => ({
                    id: file.id,
                    path: file.path
                }))
            };
        }
    });