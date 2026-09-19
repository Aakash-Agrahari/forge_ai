import { createTool } from "./toolContract.js";
import { getProjectFiles } from "../../services/fileService.js";
import {validateProjectPath} from "../projectPath.js";


export const readFileTool =
    createTool({
        name: "read_file",

        description:
            "Read the contents of a file in the current project.",

        inputSchema: {
            type: "object",

            properties: {
                path: {
                    type: "string",
                    description:
                        "The project-relative path of the file to read."
                }
            },

            required: ["path"],

            additionalProperties: false
        },

        async execute(input, context) {
            if (!context?.projectId) {
                const error = new Error(
                    "Project ID is required to read files"
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
                (item) => item.path === input.path
            );

            if (!file) {
                const error = new Error(
                    `File not found: ${input.path}`
                );

                error.code = "FILE_NOT_FOUND";

                throw error;
            }

            return {
                path: file.path,
                content: file.content
            };
        }
    });