import { selectModels } from "./modelSelector.js";

export function selectModelsForRequest({
    task = "code",
    freeOnly = true,
    toolCalling = true,
    structuredOutput = false,
    inputModality = 'text',
    outputModality = "text"
} = {}) {
    return selectModels({
        freeOnly,
        task,
        toolCalling,
        structuredOutput,
        inputModality,
        outputModality
    });
}