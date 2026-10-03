const API_BASE_URL = "/api/v1";

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        credentials: "include",

        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },

        ...options,
    });

    let data = null;

    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
        data = await response.json();
    } else {
        const text = await response.text();

        if (text) {
            data = text;
        }
    }

    if (!response.ok) {
        const error = new Error(
            data?.error?.message ||
            data?.message ||
            data?.error ||
            `Request failed with status ${response.status}`
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return data;
}

/*AUTH*/
export async function getCurrentUser() {
    return apiRequest("/auth/me");
}

export async function registerUser({
    name,
    email,
    password,
}) {
    return apiRequest("/auth/register", {
        method: "POST",

        body: JSON.stringify({
            name,
            email,
            password,
        }),
    });
}

export async function loginUser({
    email,
    password,
}) {
    return apiRequest("/auth/login", {
        method: "POST",

        body: JSON.stringify({
            email,
            password,
        }),
    });
}

export async function logoutUser() {
    return apiRequest("/auth/logout", {
        method: "POST",
    });
}

/*PROJECTS*/
export async function getProjects() {
    return apiRequest("/projects");
}

export async function getProject(projectId) {
    return apiRequest(`/projects/${projectId}`);
}

export async function createProject({
    name,
    description,
}) {
    return apiRequest("/projects", {
        method: "POST",

        body: JSON.stringify({
            name,
            description,
        }),
    });
}

export async function updateProject(
    projectId,
    data
) {
    return apiRequest(`/projects/${projectId}`, {
        method: "PATCH",

        body: JSON.stringify(data),
    });
}

export async function deleteProject(projectId) {
    return apiRequest(`/projects/${projectId}`, {
        method: "DELETE",
    });
}

export async function getProjectFiles(projectId) {
    return apiRequest(`/projects/${projectId}/files`);
}

export async function getProjectFile(projectId, fileId) {
    return apiRequest(
        `/projects/${projectId}/files/${fileId}`
    );
}

export async function updateProjectFile(
    projectId,
    fileId,
    content
) {
    return apiRequest(
        `/projects/${projectId}/files/${fileId}`,
        {
            method: "PATCH",

            body: JSON.stringify({
                content,
            }),
        }
    );
}

/*CONVERSATIONS*/
export async function createConversation(
    projectId,
    title
) {
    return apiRequest(
        `/projects/${projectId}/conversations`,
        {
            method: "POST",

            body: JSON.stringify({
                title,
            }),
        }
    );
}

export async function getConversationMessages(
    projectId,
    conversationId
) {
    return apiRequest(
        `/projects/${projectId}/conversations/${conversationId}/messages`
    );
}

export async function createConversationMessage(
    projectId,
    conversationId,
    { role, content }
) {
    return apiRequest(
        `/projects/${projectId}/conversations/${conversationId}/messages`,
        {
            method: "POST",

            body: JSON.stringify({
                role,
                content,
            }),
        }
    );
}

/*AGENT RUNS*/
export async function startAgentRun(
    projectId,
    conversationId
) {
    return apiRequest(
        `/projects/${projectId}/conversations/${conversationId}/runs`,
        {
            method: "POST",
        }
    );
}

export async function getAgentRuns(
    projectId,
    conversationId
) {
    return apiRequest(
        `/projects/${projectId}/conversations/${conversationId}/runs`
    );
}

export async function getAgentRun(
    projectId,
    conversationId,
    runId
) {
    return apiRequest(
        `/projects/${projectId}/conversations/${conversationId}/runs/${runId}`
    );
}

export async function getProjectConversations(projectId){
    return apiRequest(
        `/projects/${projectId}/conversations`
    );
}

export async function getConversationMessages(projectId, conversationId){
    return apiRequest(`/projects/${projectId}/conversations/${conversationId}/messages`);
}