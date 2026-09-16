import { getAllTools } from "./toolRegistery";

export function getAgentTools(){
    return getAllTools().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
    }));
}