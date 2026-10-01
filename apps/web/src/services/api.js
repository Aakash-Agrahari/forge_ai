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

export async function getCurrentUser() {
    return apiRequest("/auth/me");
}

export async function registerUser({ name, email, password }) {
    return apiRequest("/auth/register", {
        method: "POST",

        body: JSON.stringify({
            name,
            email,
            password,
        }),
    });
}

export async function loginUser({ email, password }) {
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