import { registerTool } from "../toolRegistery.js";
import {listFilesTool} from "./listFiles.js";
import {readFileTool} from "./readFiles.js";
import {writeFileTool} from "./writeFiles.js";
import {deleteFileTool} from "./deleteFiles.js";
import {runCommandTool} from "./runCommand.js";
import {searchFilesTool} from "./searchFiles.js";
import {replaceInFileTool} from "./replaceInFile.js";
import {insertInFileTool} from "./insertInFile.js";
import { createFileTool } from "./createFile.js";
import { renameFileTool } from "./renameFile.js";
import {moveFileTool} from "./moveFile.js";
import {copyFileTool} from "./copyFile.js";

export function registerAgentTools(){
    registerTool(listFilesTool);
    registerTool(readFileTool);
    registerTool(writeFileTool);
    registerTool(deleteFileTool);
    registerTool(runCommandTool);
    registerTool(searchFilesTool);
    registerTool(replaceInFileTool);
    registerTool(insertInFileTool);
    registerTool(createFileTool);
    registerTool(renameFileTool);
    registerTool(moveFileTool);
    registerTool(copyFileTool);
}