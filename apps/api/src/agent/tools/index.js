import { registerTool } from "../toolRegistery.js";
import {listFilesTool} from "./listFiles.js";
import {readFileTool} from "./readFiles.js";
import {writeFileTool} from "./writeFiles.js";
import {deleteFileTool} from "./deleteFiles.js";
import {runCommandTool} from "./runCommand.js";
import {searchFilesTool} from "./searchFiles.js";

export function registerAgentTools(){
    registerTool(listFilesTool);
    registerTool(readFileTool);
    registerTool(writeFileTool);
    registerTool(deleteFileTool);
    registerTool(runCommandTool);
    registerTool(searchFilesTool);
}