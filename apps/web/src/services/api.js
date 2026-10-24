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

/* =========================
   AUTH
========================= */

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

/* =========================
   PROJECTS
========================= */

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

export async function importProjectZip(file, name = "") {
    const formData = new FormData();

    formData.append("file", file);

    if (name.trim()) {
        formData.append("name", name.trim());
    }

    const response = await fetch(
        `${API_BASE_URL}/projects/import`,
        {
            method: "POST",
            credentials: "include",
            body: formData,
        }
    );

    let data = null;

    const contentType = response.headers.get(
        "content-type"
    );

    if (contentType?.includes("application/json")) {
        data = await response.json();
    } else {
        const text = await response.text();

        if (text) {
            data = text;
        }
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.error?.message ||
            data?.error ||
            `ZIP import failed with status ${response.status}`
        );
    }

    return data;
}

export async function exportProjectZip(projectId) {
    const response = await fetch(
        `${API_BASE_URL}/projects/${projectId}/export`,
        {
            method: "GET",
            credentials: "include",
        }
    );

    if (!response.ok) {
        let message =
            `ZIP export failed with status ${response.status}`;

        try {
            const data = await response.json();

            message =
                data?.message ||
                data?.error?.message ||
                data?.error ||
                message;
        } catch {
            // Ignore non-JSON error response.
        }

        throw new Error(message);
    }

    return response.blob();
}

/* =========================
   PROJECT FILES
========================= */

export async function getProjectFiles(projectId) {
    return apiRequest(`/projects/${projectId}/files`);
}

export async function createProjectFile(
    projectId,
    { path, content = "" }
) {
    return apiRequest(
        `/projects/${projectId}/files`,
        {
            method: "POST",
            body: JSON.stringify({
                path,
                content,
            }),
        }
    );
}

export async function getProjectFile(
    projectId,
    fileId
) {
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

export async function renameProjectFile(
    projectId,
    fileId,
    path
) {
    return apiRequest(
        `/projects/${projectId}/files/${fileId}`,
        {
            method: "PATCH",
            body: JSON.stringify({
                path,
            }),
        }
    );
}

export async function runProjectFile(
    projectId,
    fileId
) {
    return apiRequest(
        `/projects/${projectId}/files/${fileId}/execute`,
        {
            method: "POST",
        }
    );
}

/*===============================
 Project folders 
 ==============================*/
export async function getProjectFolders(projectId) {
    return apiRequest(`/projects/${projectId}/folders`);
}

export async function createProjectFolder(projectId, { path }) {
    return apiRequest(`/projects/${projectId}/folders`, {
        method: "POST",
        body: JSON.stringify({
            path
        })
    });
}

export async function getProjectFolder(projectId, folderId) {
    return apiRequest(
        `/projects/${projectId}/folders/${folderId}`
    );
}

export async function renameProjectFolder(
    projectId,
    folderId,
    path
) {
    return apiRequest(
        `/projects/${projectId}/folders/${folderId}`,
        {
            method: "PATCH",
            body: JSON.stringify({
                path
            })
        }
    );
}

export async function deleteProjectFolder(
    projectId,
    folderId
) {
    return apiRequest(
        `/projects/${projectId}/folders/${folderId}`,
        {
            method: "DELETE"
        }
    );
}

/* =========================
   CONVERSATIONS
========================= */

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

export async function getProjectConversations(
    projectId
) {
    return apiRequest(
        `/projects/${projectId}/conversations`
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

/* =========================
   AGENT RUNS
========================= */

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