export function createAgentModelRequest({
    messages,
    tools = [],
    toolChoice = "auto",
    temperature = 0.2,
    maxTokens = 8192
}) {
    return {
        messages,
        tools,
        toolChoice,
        temperature,
        maxTokens
    };
}