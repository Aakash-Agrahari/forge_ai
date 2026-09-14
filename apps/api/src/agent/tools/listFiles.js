import {createTool} from "../toolContract.js";

export const listFIlesTool = createTool({
    name: "list_files",
    description: "List files in the current project",
    inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
    },

    async execute(input, context){
        throw new Error("list_files is not implemented yet");
    }
});