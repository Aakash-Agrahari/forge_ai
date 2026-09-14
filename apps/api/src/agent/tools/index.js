import { registerTool } from "../toolRegistery.js";
import {listFilesTool} from "./listFiles.js";

export function registerAgentTools(){
    registerTool(listFilesTool);
}