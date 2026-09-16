import { registerAgentTools } from "./tools/index.js";
import { getAgentTools } from "./toolSchema.js";

registerAgentTools();

const tools = getAgentTools();

console.log(
    JSON.stringify(
        tools,
        null,
        2
    )
);