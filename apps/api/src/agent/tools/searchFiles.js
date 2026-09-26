import {createTool} from "./toolContract.js";
import {getProjectFiles} from "../../services/fileService.js";

const MAX_RESULTS = 50;

export const searchFilesTool = createTool({
    name: "search_files",

    description: "Search project files for a test pattern and return matching file paths and lines.",

    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The text to search for in project files."
            }
        },
        required: ["query"],
        additionalProperties: false
    },

    async execute(input, context){
        if(!context?.projectId){
            const error = new Error("Project ID is required to search files");
            error.code = "PROJECT_ID_REQUIRED";
            throw error;
        }

        if(!input?.query?.trim()){
            const error = new Error("Search query is required");
            error.code = "SEARCH_QUERY_REQUIRED";
            throw error;
        }

        const query = input.query.trim();
        const files = await getProjectFiles(context.projectId);
        const matches = [];

        for(const file of files){
            if(matches.length >= MAX_RESULTS){
                break;
            }
            if(typeof file.content !== "string"){
                continue;
            }
            const lines = file.content.split(/\r?\n/);

            for(let index=0; index<lines.length; index++){
                if(lines[index].includes(query)){
                    matches.push({
                        path: file.path,
                        line: index+1,
                        content: lines[index].trim()
                    });

                    if(matches.length >= MAX_RESULTS){
                        break;
                    }
                }
            }
        }

        return {
            success: true,
            query,
            matchCount: matches.length,
            truncated: matches.length >= MAX_RESULTS,
            matches
        };
    }
});