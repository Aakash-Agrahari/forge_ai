import { registerTool } from "../toolRegistery.js";
import {listFilesTool} from "./listFiles.js";
import {readFileTool} from "./readFiles.js";
import {writeFileTool} from "./writeFiles.js";

export function registerAgentTools(){
    registerTool(listFilesTool);
    registerTool(readFileTool);
    registerTool(writeFileTool);
}