import { useEffect, useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import "./App.css";

import {
    getCurrentUser,
    loginUser,
    registerUser,
    logoutUser,
    getProjects,
    createProject,
    deleteProject,
    importProjectZip,
    exportProjectZip,

    getProjectFiles,
    createProjectFile,
    getProjectFile,
    updateProjectFile,
    runProjectFile,

    getProjectFolders,
    createProjectFolder,
    getProjectFolder,
    renameProjectFolder,
    deleteProjectFolder,

    createConversation,
    getProjectConversations,
    getConversationMessages,
    createConversationMessage,
    startAgentRun,
    getAgentRun,
} from "./services/api";

/* =========================
   AUTH SCREEN
========================= */

function AuthScreen({ onAuthenticated }) {
    const [mode, setMode] = useState("login");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");



    async function handleSubmit(event) {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            let response;

            if (mode === "login") {
                response = await loginUser({
                    email,
                    password,
                });
            } else {
                response = await registerUser({
                    name,
                    email,
                    password,
                });
            }

            onAuthenticated(response);
        } catch (requestError) {
            setError(
                requestError.message ||
                "Something went wrong. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    function switchMode(nextMode) {
        setMode(nextMode);
        setError("");
    }

    return (
        <div className="auth-page">

            <div className="auth-background">
                <div className="auth-glow auth-glow-one"></div>
                <div className="auth-glow auth-glow-two"></div>
            </div>

            <div className="auth-card">

                <div className="auth-brand">

                    <div className="auth-brand-mark">
                        F
                    </div>

                    <div>
                        <div className="auth-brand-name">
                            ForgeAI
                        </div>

                        <div className="auth-brand-subtitle">
                            Autonomous AI Engineer
                        </div>
                    </div>

                </div>

                <div className="auth-heading">

                    <h1>
                        {mode === "login"
                            ? "Welcome back"
                            : "Create your account"}
                    </h1>

                    <p>
                        {mode === "login"
                            ? "Sign in to continue building with ForgeAI."
                            : "Create your ForgeAI workspace and start building."}
                    </p>

                </div>

                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                >

                    {mode === "register" && (
                        <div className="form-field">

                            <label htmlFor="name">
                                Name
                            </label>

                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                placeholder="Your name"
                                autoComplete="name"
                                required
                            />

                        </div>
                    )}

                    <div className="form-field">

                        <label htmlFor="email">
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                        />

                    </div>

                    <div className="form-field">

                        <label htmlFor="password">
                            Password
                        </label>

                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                            placeholder="Enter your password"
                            autoComplete={
                                mode === "login"
                                    ? "current-password"
                                    : "new-password"
                            }
                            required
                        />

                    </div>

                    {error && (
                        <div className="auth-error">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="auth-submit"
                        disabled={loading}
                    >
                        {loading
                            ? "Please wait..."
                            : mode === "login"
                                ? "Sign In"
                                : "Create Account"}
                    </button>

                </form>

                <div className="auth-switch">

                    {mode === "login" ? (
                        <>
                            <span>
                                Don't have an account?
                            </span>

                            <button
                                type="button"
                                onClick={() =>
                                    switchMode("register")
                                }
                            >
                                Create account
                            </button>
                        </>
                    ) : (
                        <>
                            <span>
                                Already have an account?
                            </span>

                            <button
                                type="button"
                                onClick={() =>
                                    switchMode("login")
                                }
                            >
                                Sign in
                            </button>
                        </>
                    )}

                </div>

            </div>

        </div>
    );
}

/* =========================
   PROJECT DASHBOARD
========================= */

function ProjectDashboard({
    user,
    onOpenProject,
    onLogout,
}) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showCreateForm, setShowCreateForm] =
        useState(false);

    const [importing, setImporting] = useState(false);
    const importInputRef = useRef(null);

    const [projectName, setProjectName] =
        useState("");

    const [projectDescription, setProjectDescription] =
        useState("");

    const [creating, setCreating] =
        useState(false);

    const [deletingProjectId, setDeletingProjectId] =
        useState(null);

    async function loadProjects() {
        setLoading(true);
        setError("");

        try {
            const response = await getProjects();

            setProjects(response?.projects || []);
        } catch (requestError) {
            setError(
                requestError.message ||
                "Unable to load your projects."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadProjects();
    }, []);

    async function handleCreateProject(event) {
        event.preventDefault();

        if (!projectName.trim()) {
            return;
        }

        setCreating(true);
        setError("");

        try {
            const response = await createProject({
                name: projectName.trim(),
                description:
                    projectDescription.trim() || undefined,
            });

            const newProject = response?.project;

            if (newProject) {
                setProjects((currentProjects) => [
                    newProject,
                    ...currentProjects,
                ]);

                setProjectName("");
                setProjectDescription("");
                setShowCreateForm(false);

                onOpenProject(newProject);
            }
        } catch (requestError) {
            setError(
                requestError.message ||
                "Unable to create the project."
            );
        } finally {
            setCreating(false);
        }
    }

    async function handleImportProject(event) {
        const file = event.target.files?.[0];

        event.target.value = "";

        if (!file) {
            return;
        }

        if (!file.name.toLowerCase().endsWith(".zip")) {
            setError("Please select a ZIP file.");
            return;
        }

        setImporting(true);
        setError("");

        try {
            const defaultName = file.name
                .replace(/\.zip$/i, "")
                .trim();

            const projectName = window.prompt(
                "Enter a name for the imported project:",
                defaultName || "Imported Project"
            );

            if (projectName === null) {
                return;
            }

            const trimmedName =
                projectName.trim() || defaultName || "Imported Project";

            const response = await importProjectZip(
                file,
                trimmedName
            );

            const importedProject = response?.project;

            if (!importedProject) {
                throw new Error(
                    "Project was imported, but no project was returned."
                );
            }

            setProjects((currentProjects) => [
                importedProject,
                ...currentProjects,
            ]);

            onOpenProject(importedProject);
        } catch (requestError) {
            console.error(
                "Failed to import project ZIP:",
                requestError
            );

            setError(
                requestError.message ||
                "Unable to import the project ZIP."
            );
        } finally {
            setImporting(false);
        }
    }

    async function handleDeleteProject(
        event,
        projectId
    ) {
        event.stopPropagation();

        const confirmed = window.confirm(
            "Delete this project? This cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        setDeletingProjectId(projectId);
        setError("");

        try {
            await deleteProject(projectId);

            setProjects((currentProjects) =>
                currentProjects.filter(
                    (project) =>
                        project.id !== projectId
                )
            );
        } catch (requestError) {
            setError(
                requestError.message ||
                "Unable to delete the project."
            );
        } finally {
            setDeletingProjectId(null);
        }
    }


    function formatDate(dateValue) {
        if (!dateValue) {
            return "Recently";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Recently";
        }

        return date.toLocaleDateString(
            undefined,
            {
                month: "short",
                day: "numeric",
                year: "numeric",
            }
        );
    }

    return (
        <div className="dashboard-page">

            <header className="dashboard-header">

                <div className="dashboard-brand">

                    <div className="brand-mark">
                        F
                    </div>

                    <div>
                        <div className="brand-name">
                            ForgeAI
                        </div>

                        <div className="brand-subtitle">
                            Autonomous AI Engineer
                        </div>
                    </div>

                </div>

                <div className="dashboard-user">

                    <div className="dashboard-user-info">
                        <span>
                            {user?.name ||
                                user?.email ||
                                "Developer"}
                        </span>

                        <small>
                            Workspace
                        </small>
                    </div>

                    <button
                        className="dashboard-logout"
                        onClick={onLogout}
                    >
                        Sign out
                    </button>

                </div>

            </header>

            <main className="dashboard-content">

                <div className="dashboard-title-actions">

                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".zip,application/zip"
                        style={{ display: "none" }}
                        onChange={handleImportProject}
                    />

                    <button
                        className="import-project-button"
                        type="button"
                        onClick={() =>
                            importInputRef.current?.click()
                        }
                        disabled={importing}
                    >
                        <span>↑</span>
                        {importing ? "Importing..." : "Import ZIP"}
                    </button>

                    <button
                        className="create-project-button"
                        onClick={() =>
                            setShowCreateForm(true)
                        }
                    >
                        <span>+</span>
                        New Project
                    </button>

                </div>

                {error && (
                    <div className="dashboard-error">
                        {error}
                    </div>
                )}

                {showCreateForm && (
                    <div className="create-project-card">

                        <div className="create-project-heading">
                            <div>
                                <h2>
                                    Create a project
                                </h2>

                                <p>
                                    Start a new ForgeAI
                                    workspace.
                                </p>
                            </div>

                            <button
                                className="close-create-button"
                                onClick={() =>
                                    setShowCreateForm(false)
                                }
                            >
                                ×
                            </button>
                        </div>

                        <form
                            className="create-project-form"
                            onSubmit={handleCreateProject}
                        >

                            <div className="form-field">

                                <label htmlFor="project-name">
                                    Project name
                                </label>

                                <input
                                    id="project-name"
                                    type="text"
                                    value={projectName}
                                    onChange={(event) =>
                                        setProjectName(
                                            event.target.value
                                        )
                                    }
                                    placeholder="My awesome project"
                                    required
                                />

                            </div>

                            <div className="form-field">

                                <label htmlFor="project-description">
                                    Description
                                </label>

                                <textarea
                                    id="project-description"
                                    value={projectDescription}
                                    onChange={(event) =>
                                        setProjectDescription(
                                            event.target.value
                                        )
                                    }
                                    placeholder="What are you building?"
                                    rows="3"
                                />

                            </div>

                            <div className="create-project-actions">

                                <button
                                    type="button"
                                    className="cancel-project-button"
                                    onClick={() =>
                                        setShowCreateForm(false)
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="submit-project-button"
                                    disabled={creating}
                                >
                                    {creating
                                        ? "Creating..."
                                        : "Create Project"}
                                </button>

                            </div>

                        </form>

                    </div>
                )}

                {loading ? (
                    <div className="projects-loading">
                        <div className="loading-mark">
                            F
                        </div>

                        <span>
                            Loading projects...
                        </span>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="projects-empty">

                        <div className="empty-icon">
                            +
                        </div>

                        <h2>
                            No projects yet
                        </h2>

                        <p>
                            Create your first project
                            and start building with
                            ForgeAI.
                        </p>

                        <button
                            className="create-project-button"
                            onClick={() =>
                                setShowCreateForm(true)
                            }
                        >
                            <span>+</span>
                            Create your first project
                        </button>

                    </div>
                ) : (
                    <div className="projects-grid">

                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className="project-card"
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                    onOpenProject(project)
                                }
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Enter" ||
                                        event.key === " "
                                    ) {
                                        event.preventDefault();
                                        onOpenProject(project);
                                    }
                                }}
                            >

                                <div className="project-card-top">

                                    <div className="project-icon">
                                        F
                                    </div>

                                    <button
                                        type="button"
                                        className="project-delete-button"
                                        onClick={(event) =>
                                            handleDeleteProject(
                                                event,
                                                project.id
                                            )
                                        }
                                        disabled={
                                            deletingProjectId ===
                                            project.id
                                        }
                                        title="Delete project"
                                    >
                                        ×
                                    </button>

                                </div>

                                <div className="project-card-name">
                                    {project.name}
                                </div>

                                <div className="project-card-description">
                                    {project.description ||
                                        "No description provided."}
                                </div>

                                <div className="project-card-footer">

                                    <span>
                                        Updated{" "}
                                        {formatDate(
                                            project.updatedAt ||
                                                project.createdAt
                                        )}
                                    </span>

                                    <span>
                                        Open →
                                    </span>

                                </div>

                            </div>
                        ))}

                    </div>
                )}

            </main>

        </div>
    );
}

/* =========================
   WORKSPACE
========================= */

function Workspace({
    user,
    project,
    onLogout,
    onBackToDashboard,
}) {
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [expandedFolders, setExpandedFolders] = 
        useState(new Set());
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [creatingItem, setCreatingItem] = useState(false);    
    const [agentChangedFileIds, setAgentChangedFileIds] =
        useState(new Set());
    const [activeFileId, setActiveFileId] = useState(null);
    const [activeFile, setActiveFile] = useState(null);

    const [fileContent, setFileContent] = useState("");
    const [originalContent, setOriginalContent] = useState("");

    const hasUnsavedChanges = fileContent !== originalContent;

    const [loadingFiles, setLoadingFiles] = useState(true);
    const [loadingFile, setLoadingFile] = useState(false);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [executionResult, setExecutionResult] = useState(null);
    const [exporting, setExporting] = useState(false);

    const [error, setError] = useState("");
    const [saveMessage, setSaveMessage] = useState("");

    const [message, setMessage] = useState("");

    const saveFileRef = useRef(null);
    const allowPageReloadRef = useRef(false);

    const editorPanelRef = useRef(null);
    const resizeStateRef = useRef(null);

    const [sidebarWidth, setSidebarWidth] = useState(220);
    const [agentWidth, setAgentWidth] = useState(360);
    const [outputHeight, setOutputHeight] = useState(160);

    const [conversations, setConversations] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [conversationMessages, setConversationMessages] = useState([]);
    const [loadingConversation, setLoadingConversation] = useState(true);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [agentError, setAgentError] = useState("");
    const conversationEndRef = useRef(null);

    const projectName =
        project?.name || "ForgeAI Project";

    function startPanelResize(type, event) {
    event.preventDefault();

    resizeStateRef.current = {
        type,
        startX: event.clientX,
        startY: event.clientY,
        startSidebarWidth: sidebarWidth,
        startAgentWidth: agentWidth,
        startOutputHeight: outputHeight,
    };

    if (type === "sidebar" || type === "agent") {
        document.body.style.cursor = "col-resize";
    }

    if (type === "output") {
        document.body.style.cursor = "row-resize";
    }

    document.body.style.userSelect = "none";
}

useEffect(() => {
    function handlePanelResize(event) {
        const resizeState = resizeStateRef.current;

        if (!resizeState) {
            return;
        }

        if (resizeState.type === "sidebar") {
            const deltaX =
                event.clientX - resizeState.startX;

            const nextWidth =
                resizeState.startSidebarWidth + deltaX;

            setSidebarWidth(
                Math.min(
                    420,
                    Math.max(160, nextWidth)
                )
            );
        }

        if (resizeState.type === "agent") {
            const deltaX =
                resizeState.startX - event.clientX;

            const nextWidth =
                resizeState.startAgentWidth + deltaX;

            setAgentWidth(
                Math.min(
                    600,
                    Math.max(280, nextWidth)
                )
            );
        }

        if (resizeState.type === "output") {
            const deltaY =
                resizeState.startY - event.clientY;

            const editorPanel =
                editorPanelRef.current;

            if (!editorPanel) {
                return;
            }

            const editorHeight =
                editorPanel.getBoundingClientRect().height;

            const maxOutputHeight =
                Math.max(180, editorHeight - 260);

            const nextHeight =
                resizeState.startOutputHeight + deltaY;

            setOutputHeight(
                Math.min(
                    maxOutputHeight,
                    Math.max(80, nextHeight)
                )
            );
        }
    }

    function stopPanelResize() {
        resizeStateRef.current = null;

        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    }

    window.addEventListener(
        "mousemove",
        handlePanelResize
    );

    window.addEventListener(
        "mouseup",
        stopPanelResize
    );

    return () => {
        window.removeEventListener(
            "mousemove",
            handlePanelResize
        );

        window.removeEventListener(
            "mouseup",
            stopPanelResize
        );

        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    };
}, [
    sidebarWidth,
    agentWidth,
    outputHeight,
]);    

    async function loadConversationHistory(projectId) {
        if (!projectId) {
            return;
        }

        setLoadingConversation(true);
        setAgentError("");

        try {
            const response = await getProjectConversations(projectId);
            const projectConversations = response?.conversations || [];

            setConversations(projectConversations);

            const latestConversation = projectConversations[0] || null;

            if (!latestConversation) {
                setConversationId(null);
                setConversationMessages([]);
                return;
            }

            setConversationId(latestConversation.id);

            const messagesResponse = await getConversationMessages(
                projectId,
                latestConversation.id
            );

            setConversationMessages(messagesResponse?.messages || []);
        } catch (requestError) {
            setAgentError(
                requestError.message ||
                    "Unable to load the conversation history."
            );
        } finally {
            setLoadingConversation(false);
        }
    }

    async function loadConversation(projectId, selectedConversationId) {
        if (!projectId || !selectedConversationId) {
            return;
        }

        setLoadingConversation(true);
        setAgentError("");

        try {
            const messagesResponse = await getConversationMessages(
                projectId,
                selectedConversationId
            );

            setConversationId(selectedConversationId);
            setConversationMessages(messagesResponse?.messages || []);
        } catch (requestError) {
            setAgentError(
                requestError.message ||
                    "Unable to load this conversation."
            );
        } finally {
            setLoadingConversation(false);
        }
    }

    function handleNewConversation() {
        if (sendingMessage) {
            return;
        }

        setConversationId(null);
        setConversationMessages([]);
        setMessage("");
        setAgentError("");
    }

    useEffect(() => {
        loadConversationHistory(project?.id);
    }, [project?.id]);

    useEffect(() => {
        conversationEndRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [conversationMessages, sendingMessage]);

    async function refreshProjectStructure({ markAgentChanges = false } = {}) {
        if (!project?.id) {
            return null;
        }

        try {
            const [fileResponse, folderResponse] = await Promise.all([
                getProjectFiles(project.id),
                getProjectFolders(project.id)
            ]);

            const nextFiles = fileResponse?.files || [];
            const nextFolders = folderResponse?.folders || [];

            setFiles(nextFiles);
            setFolders(nextFolders);

            if (markAgentChanges) {
                setAgentChangedFileIds(
                    new Set(nextFiles.map((file) => file.id))
                );
            }

            return {
                files: nextFiles,
                folders: nextFolders
            };
        } catch (err) {
            console.error("Failed to refresh project structure:", err);
            setError(err?.message || "Failed to refresh project structure");
            return null;
        }
    }

    //changes is done hereeeeeeeeeeeee
    async function refreshProjectFiles({ markAgentChanges = false } = {}) {
        return refreshProjectStructure({ markAgentChanges });
    }

    async function handleCreateProjectItem(type) {
        if (!project?.id || creatingItem) {
            return;
        }

        const itemName = window.prompt(
            type === "file"
                ? "Enter file path (example: src/App.java)"
                : "Enter folder path (example: src/components)"
        );

        if (!itemName || !itemName.trim()) {
            return;
        }

        const path = itemName
            .trim()
            .replace(/\\/g, "/")
            .replace(/^\/+|\/+$/g, "");

        if (!path) {
            return;
        }

        try {
            setCreatingItem(true);
            setError("");
            setShowCreateMenu(false);

            if (type === "file") {
                await createProjectFile(project.id, {
                    path,
                    content: ""
                });
            } else {
                await createProjectFolder(project.id, {
                    path
                });
            }

            await refreshProjectStructure();
        } catch (err) {
            console.error(`Failed to create ${type}:`, err);

            setError(
                err?.message ||
                `Failed to create ${type === "file" ? "file" : "folder"}`
            );
        } finally {
            setCreatingItem(false);
        }
    }

    async function waitForAgentRun(
        projectId,
        currentConversationId,
        runId
    ) {
        const maxAttempts = 180;
        const delayMs = 1000;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const response = await getAgentRun(
                projectId,
                currentConversationId,
                runId
            );

            const run = response?.run;

            if (!run) {
                throw new Error(
                    "Unable to find the ForgeAI agent run."
                );
            }

            if (run.status === "completed") {
                return run;
            }

            if (run.status === "failed") {
                throw new Error(
                    run.error ||
                        "ForgeAI could not complete the requested task."
                );
            }

            if (
                run.status !== "queued" &&
                run.status !== "running"
            ) {
                throw new Error(
                    `ForgeAI run ended with unexpected status: ${run.status}`
                );
            }

            if (attempt < maxAttempts - 1) {
                await new Promise((resolve) =>
                    window.setTimeout(resolve, delayMs)
                );
            }
        }

        throw new Error(
            "ForgeAI is taking longer than expected. The agent may still be running."
        );
    }

    async function handleSendMessage() {
        const trimmedMessage = message.trim();

        if (
            !trimmedMessage ||
            !project?.id ||
            sendingMessage
        ) {
            return;
        }

        setSendingMessage(true);
        setAgentError("");

        try {
            let currentConversationId = conversationId;

            if (!currentConversationId) {
                const conversationResponse =
                    await createConversation(
                        project.id,
                        trimmedMessage.slice(0, 80)
                    );

                currentConversationId =
                    conversationResponse?.conversation?.id;

                if (!currentConversationId) {
                    throw new Error(
                        "Unable to create an agent conversation"
                    );
                }

                setConversationId(currentConversationId);
            }

            const userMessageResponse = await createConversationMessage(
                project.id,
                currentConversationId,
                {
                    role: "user",
                    content: trimmedMessage,
                }
            );

            const persistedUserMessage = userMessageResponse?.message;

            setConversationMessages((currentMessages) => [
                ...currentMessages,
                persistedUserMessage || {
                    id: `local-${Date.now()}`,
                    role: "user",
                    content: trimmedMessage,
                    createdAt: new Date().toISOString(),
                },
            ]);

            const filesBeforeAgent = [...files];

            const runResponse = await startAgentRun(
                project.id,
                currentConversationId
            );

            const runId = runResponse?.run?.id;

            if (!runId) {
                throw new Error(
                    "ForgeAI started without returning an agent run ID."
                );
            }

            // Wait for this exact run to finish. Do not guess
            // completion from whether project files have changed.
            await waitForAgentRun(
                project.id,
                currentConversationId,
                runId
            );

            const messagesResponse = await getConversationMessages(
                project.id,
                currentConversationId
            );

            setConversationMessages(messagesResponse?.messages || []);

            const conversationsResponse = await getProjectConversations(
                project.id
            );

            setConversations(conversationsResponse?.conversations || []);

            // The agent has completed all iterations and tool calls.
            // Refresh the project only after that completion.
            const response = await getProjectFiles(project.id);
            const agentFiles = response?.files || [];

            const previousFileMap = new Map(
                filesBeforeAgent.map((file) => [file.id, file])
            );

            const changedIds = agentFiles
                .filter((file) => {
                    const previousFile = previousFileMap.get(file.id);

                    return (
                        !previousFile ||
                        previousFile.content !== file.content ||
                        previousFile.path !== file.path
                    );
                })
                .map((file) => file.id);

            if (changedIds.length > 0) {
                setAgentChangedFileIds((currentIds) => {
                    const nextIds = new Set(currentIds);

                    changedIds.forEach((id) =>
                        nextIds.add(id)
                    );

                    return nextIds;
                });
            }

            setFiles(agentFiles);

            setActiveFileId((currentActiveFileId) => {
                if (
                    currentActiveFileId &&
                    agentFiles.some(
                        (file) =>
                            file.id === currentActiveFileId
                    )
                ) {
                    return currentActiveFileId;
                }

                return agentFiles[0]?.id ?? null;
            });

            setMessage("");
        } catch (requestError) {
            setAgentError(
                requestError.message ||
                    "Unable to start the ForgeAI agent."
            );
        } finally {
            setSendingMessage(false);
        }
    }


    async function handleExportProject() {
        if (!project?.id || exporting) {
            return;
        }

        try {
            setExporting(true);
            setError("");

            const blob = await exportProjectZip(project.id);

            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");

            link.href = url;

            const safeProjectName =
                (project.name || "forgeai-project")
                    .replace(/[^a-zA-Z0-9-_ ]/g, "")
                    .trim()
                    .replace(/\s+/g, "-") ||
                "forgeai-project";

            link.download =
                `${safeProjectName}.zip`;

            document.body.appendChild(link);

            link.click();

            link.remove();

            window.URL.revokeObjectURL(url);
        } catch (requestError) {
            console.error(
                "Failed to export project:",
                requestError
            );

            setError(
                requestError.message ||
                "Unable to export the project."
            );
        } finally {
            setExporting(false);
        }
    }

    /*
     * =========================
     * LOAD PROJECT FILES
     * =========================
     */

    useEffect(() => {
        let cancelled = false;

        async function loadProjectStructure() {
            if (!project?.id) {
                return;
            }

            setLoadingFiles(true);
            setError("");
            setSaveMessage("");

            try {
                const [
                    filesResponse,
                    foldersResponse
                ] = await Promise.all([
                    getProjectFiles(project.id),
                    getProjectFolders(project.id)
                ]);

                if (cancelled) {
                    return;
                }

                const projectFiles =
                    filesResponse?.files || [];

                const projectFolders =
                    foldersResponse?.folders || [];

                setFiles(projectFiles);
                setFolders(projectFolders);

                setActiveFileId(
                    (currentActiveFileId) => {
                        if (
                            currentActiveFileId &&
                            projectFiles.some(
                                (file) =>
                                    file.id ===
                                    currentActiveFileId
                            )
                        ) {
                            return currentActiveFileId;
                        }

                        return (
                            projectFiles[0]?.id ??
                            null
                        );
                    }
                );

                /*
                * Automatically expand folders that
                * already contain files.
                */
                setExpandedFolders((currentExpanded) => {
                    const nextExpanded = new Set(
                        currentExpanded
                    );

                    projectFolders.forEach((folder) => {
                        const folderPrefix =
                            `${folder.path}/`;

                        const hasFiles =
                            projectFiles.some((file) =>
                                file.path.startsWith(
                                    folderPrefix
                                )
                            );

                        if (hasFiles) {
                            nextExpanded.add(folder.id);
                        }
                    });

                    return nextExpanded;
                });

                if (projectFiles.length === 0) {
                    setActiveFile(null);
                    setFileContent("");
                    setOriginalContent("");
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(
                        requestError.message ||
                            "Unable to load project files and folders."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingFiles(false);
                }
            }
        }

        loadProjectStructure();

        return () => {
            cancelled = true;
        };
    }, [project?.id]);

    /*
     * =========================
     * LOAD ACTIVE FILE
     * =========================
     */

    useEffect(() => {
        let cancelled = false;

        async function loadActiveFile() {
            if (!project?.id || !activeFileId) {
                return;
            }

            setLoadingFile(true);
            setError("");
            setSaveMessage("");

            try {
                const response =
                    await getProjectFile(
                        project.id,
                        activeFileId
                    );

                if (cancelled) {
                    return;
                }

                const file =
                    response?.file || null;

                if (!file) {
                    throw new Error(
                        "File could not be loaded."
                    );
                }

                setActiveFile(file);
                setFileContent(
                    file.content || ""
                );
                setOriginalContent(
                    file.content || ""
                );
            } catch (requestError) {
                if (!cancelled) {
                    setError(
                        requestError.message ||
                        "Unable to load the file."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingFile(false);
                }
            }
        }

        loadActiveFile();

        return () => {
            cancelled = true;
        };
    }, [project?.id, activeFileId]);

    /*
     * =========================
     * SAVE FILE
     * =========================
     */

    async function handleSaveFile() {
        if (!project?.id || !activeFileId) {
            return;
        }

        setSaving(true);
        setError("");
        setSaveMessage("");

        try {
            const response =
                await updateProjectFile(
                    project.id,
                    activeFileId,
                    fileContent
                );

            const updatedFile =
                response?.file || null;

            if (updatedFile) {
                setActiveFile(updatedFile);

                setFileContent(
                    updatedFile.content || ""
                );

                setOriginalContent(
                    updatedFile.content || ""
                );

                setFiles((currentFiles) =>
                    currentFiles.map((file) =>
                        file.id === updatedFile.id
                            ? updatedFile
                            : file
                    )
                );

                setAgentChangedFileIds((currentIds) => {
                    const nextIds = new Set(currentIds);
                    nextIds.delete(updatedFile.id);
                    return nextIds;
                });
            } else {
                setOriginalContent(
                    fileContent
                );
            }

            setSaveMessage("Saved");
        } catch (requestError) {
            setError(
                requestError.message ||
                "Unable to save the file."
            );
        } finally {
            setSaving(false);

            window.setTimeout(() => {
                setSaveMessage("");
            }, 2000);
        }
    }

    /*
    * =========================
    * RUN FILE
    * =========================
    */

    async function handleRunFile() {
        if (
            !project?.id ||
            !activeFileId ||
            !activeFile
        ) {
            return;
        }

        setRunning(true);
        setError("");
        setExecutionResult(null);
        setSaveMessage("");

        try {
            /*
            * Always save the current editor content
            * before execution so the backend runs
            * exactly what is visible in the editor.
            */
            if (hasUnsavedChanges) {
                const saveResponse =
                    await updateProjectFile(
                        project.id,
                        activeFileId,
                        fileContent
                    );

                const updatedFile =
                    saveResponse?.file || null;

                if (!updatedFile) {
                    throw new Error(
                        "Unable to save the file before execution."
                    );
                }

                setActiveFile(updatedFile);

                setFileContent(
                    updatedFile.content || ""
                );

                setOriginalContent(
                    updatedFile.content || ""
                );

                setFiles((currentFiles) =>
                    currentFiles.map((file) =>
                        file.id === updatedFile.id
                            ? updatedFile
                            : file
                    )
                );

                setAgentChangedFileIds((currentIds) => {
                    const nextIds = new Set(currentIds);
                    nextIds.delete(updatedFile.id);
                    return nextIds;
                });
            }

            /*
            * Execute the selected project file
            * through the existing backend execution
            * service and sandbox.
            */
            const response =
                await runProjectFile(
                    project.id,
                    activeFileId
                );

            setExecutionResult(
                response?.result ||
                response?.executionResult ||
                response?.data ||
                response
            );
        } catch (requestError) {
            console.error(
                "Failed to run file:",
                requestError
            );

            setExecutionResult({
                success: false,
                stage: "execution",
                execution: {
                    success: false,
                    exitCode: null,
                    stdout: "",
                    stderr:
                        requestError?.message ||
                        "Unable to execute the file.",
                    status: "failed"
                }
            });

            setError(
                requestError?.message ||
                "Unable to execute the file."
            );
        } finally {
            setRunning(false);
        }
    }

    saveFileRef.current = handleSaveFile;

    /*
     * =========================
     * KEYBOARD SAVE
     * =========================
     */

    function handleEditorKeyDown(event) {
        if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "s"
        ) {
            event.preventDefault();
            handleSaveFile();
        }
    }


    useEffect(() => {
        function handleBeforeUnload(event) {
            if (
                !hasUnsavedChanges ||
                allowPageReloadRef.current
            ) {
                return;
            }

            event.preventDefault();
            event.returnValue = "";
        }

        function handleRefreshShortcut(event) {
            const isRefresh =
                event.key === "F5" ||
                (
                    (event.ctrlKey || event.metaKey) &&
                    event.key.toLowerCase() === "r"
                );

            if (!isRefresh || !hasUnsavedChanges) {
                return;
            }

            event.preventDefault();

            const shouldReload = window.confirm(
                "You have unsaved changes. If you refresh, all unsaved changes will be lost. Do you want to continue?"
            );

            if (!shouldReload) {
                return;
            }

            allowPageReloadRef.current = true;
            window.location.reload();
        }

        window.addEventListener(
            "beforeunload",
            handleBeforeUnload
        );

        window.addEventListener(
            "keydown",
            handleRefreshShortcut
        );

        return () => {
            window.removeEventListener(
                "beforeunload",
                handleBeforeUnload
            );

            window.removeEventListener(
                "keydown",
                handleRefreshShortcut
            );
        };
    }, [hasUnsavedChanges]);

    /*
     * =========================
     * FILE HELPERS
     * =========================
     */

    function getFileName(path) {
        return path.split("/").pop();
    }

    function getDirectory(path) {
        const parts = path.split("/");

        if (parts.length === 1) {
            return "root";
        }

        return parts.slice(0, -1).join("/");
    }

    function getEditorLanguage(path) {
      const lowerPath = path.toLowerCase();

      if (
          lowerPath.endsWith(".jsx") ||
          lowerPath.endsWith(".tsx")
      ) {
          return "javascript";
      }

      if (
          lowerPath.endsWith(".js") ||
          lowerPath.endsWith(".mjs") ||
          lowerPath.endsWith(".cjs")
      ) {
          return "javascript";
      }

      if (lowerPath.endsWith(".json")) {
          return "json";
      }

      if (
          lowerPath.endsWith(".css") ||
          lowerPath.endsWith(".scss") ||
          lowerPath.endsWith(".less")
      ) {
          return "css";
      }

      if (
          lowerPath.endsWith(".html") ||
          lowerPath.endsWith(".htm")
      ) {
          return "html";
      }

      if (lowerPath.endsWith(".md")) {
          return "markdown";
      }

      if (lowerPath.endsWith(".py")) {
          return "python";
      }

      if (lowerPath.endsWith(".java")) {
          return "java";
      }

      if (lowerPath.endsWith(".sql")) {
          return "sql";
      }

      if (lowerPath.endsWith(".xml")) {
          return "xml";
      }

      if (lowerPath.endsWith(".sh")) {
          return "shell";
      }

      if (lowerPath.endsWith(".yml") ||
          lowerPath.endsWith(".yaml")) {
          return "yaml";
      }

      return "plaintext";
  }

    function getFileIcon(path) {
        if (path.endsWith(".jsx")) {
            return "◇";
        }

        if (path.endsWith(".js")) {
            return "◇";
        }

        if (path.endsWith(".json")) {
            return "{}";
        }

        if (path.endsWith(".css")) {
            return "#";
        }

        if (path.endsWith(".html")) {
            return "<>";
        }

        if (path.endsWith(".md")) {
            return "M";
        }

        return "◇";
    }

    function toggleFolder(folderId) {
        setExpandedFolders((currentExpanded) => {
            const nextExpanded = new Set(
                currentExpanded
            );

            if (nextExpanded.has(folderId)) {
                nextExpanded.delete(folderId);
            } else {
                nextExpanded.add(folderId);
            }

            return nextExpanded;
        });
    }

    

    /*
     * =========================
     * RENDER FILE TREE
     * =========================
     */

    function renderFileTree() {
        const normalizePath = (value = "") =>
            value
                .replace(/\\/g, "/")
                .replace(/^\/+|\/+$/g, "");

        const getNameFromPath = (path = "") => {
            const normalized = normalizePath(path);
            const parts = normalized.split("/");
            return parts[parts.length - 1] || normalized;
        };

        const getParentPath = (path = "") => {
            const normalized = normalizePath(path);
            const lastSlash = normalized.lastIndexOf("/");

            if (lastSlash === -1) {
                return "";
            }

            return normalized.substring(0, lastSlash);
        };

        /*
        * Build a virtual tree from:
        *
        * 1. Explicit folders stored in the database
        * 2. Folder paths implied by existing files
        *
        * This means:
        *
        * src/
        *   utils/
        *     helper.js
        *
        * works even if only helper.js exists in the database.
        */

        const folderMap = new Map();

        folders.forEach((folder) => {
            const path = normalizePath(folder.path);

            if (!path) {
                return;
            }

            folderMap.set(path, {
                id: folder.id,
                path,
                name: getNameFromPath(path),
                explicit: true
            });
        });

        files.forEach((file) => {
            const normalizedPath = normalizePath(file.path);
            const parts = normalizedPath.split("/");

            if (parts.length <= 1) {
                return;
            }

            let currentPath = "";

            for (let index = 0; index < parts.length - 1; index += 1) {
                currentPath = currentPath
                    ? `${currentPath}/${parts[index]}`
                    : parts[index];

                if (!folderMap.has(currentPath)) {
                    folderMap.set(currentPath, {
                        id: `virtual-folder-${currentPath}`,
                        path: currentPath,
                        name: parts[index],
                        explicit: false
                    });
                }
            }
        });

        const tree = {
            folders: new Map(),
            files: []
        };

        /*
        * Build folder nodes.
        */
        [...folderMap.values()].forEach((folder) => {
            const parentPath = getParentPath(folder.path);

            const node = {
                ...folder,
                folders: [],
                files: []
            };

            tree.folders.set(folder.path, node);

            if (parentPath && folderMap.has(parentPath)) {
                const parent = tree.folders.get(parentPath);

                if (parent) {
                    parent.folders.push(node);
                }
            }
        });

        /*
        * Root-level files.
        */
        files.forEach((file) => {
            const normalizedPath = normalizePath(file.path);
            const parentPath = getParentPath(normalizedPath);

            if (!parentPath) {
                tree.files.push(file);
                return;
            }

            const parent = tree.folders.get(parentPath);

            if (parent) {
                parent.files.push(file);
            }
        });

        const sortFiles = (items) =>
            [...items].sort((a, b) =>
                normalizePath(a.path).localeCompare(
                    normalizePath(b.path),
                    undefined,
                    {
                        numeric: true,
                        sensitivity: "base"
                    }
                )
            );

        const sortFolders = (items) =>
            [...items].sort((a, b) =>
                a.name.localeCompare(
                    b.name,
                    undefined,
                    {
                        numeric: true,
                        sensitivity: "base"
                    }
                )
            );

        const renderFile = (file, depth = 0) => {
            const isActive = file.id === activeFileId;
            const isAgentChanged = agentChangedFileIds.has(file.id);

            return (
                <button
                    key={`file-${file.id}`}
                    type="button"
                    className={`file-tree-item ${isActive ? "active" : ""}`}
                    style={{
                        paddingLeft: `${12 + depth * 18}px`
                    }}
                    onClick={() => {
                        setActiveFileId(file.id);
                    }}
                    title={file.path}
                >
                    <span className="file-tree-icon">
                        {getFileIcon(file.path)}
                    </span>

                    <span className="file-tree-name">
                        {getFileName(file.path)}
                    </span>

                    {isAgentChanged && (
                        <span
                            className="file-tree-agent-dot"
                            title="Changed by ForgeAI"
                        />
                    )}
                </button>
            );
        };

        const renderFolder = (folder, depth = 0) => {
            const isExpanded = expandedFolders.has(folder.id);

            const childFolders = sortFolders(folder.folders);
            const childFiles = sortFiles(folder.files);

            return (
                <div
                    key={`folder-${folder.path}`}
                    className="file-tree-folder"
                >
                    <button
                        type="button"
                        className="file-tree-folder-item"
                        style={{
                            paddingLeft: `${12 + depth * 18}px`
                        }}
                        onClick={() => {
                            toggleFolder(folder.id);
                        }}
                        title={folder.path}
                    >
                        <span className="file-tree-chevron">
                            {isExpanded ? "⌄" : "›"}
                        </span>

                        <span className="file-tree-folder-icon">
                            {isExpanded ? "📂" : "📁"}
                        </span>

                        <span className="file-tree-name">
                            {folder.name}
                        </span>
                    </button>

                    {isExpanded && (
                        <div className="file-tree-folder-children">
                            {childFolders.map((childFolder) =>
                                renderFolder(
                                    childFolder,
                                    depth + 1
                                )
                            )}

                            {childFiles.map((file) =>
                                renderFile(
                                    file,
                                    depth + 1
                                )
                            )}
                        </div>
                    )}
                </div>
            );
        };

        const rootFolders = sortFolders(
            [...tree.folders.values()].filter(
                (folder) =>
                    getParentPath(folder.path) === ""
            )
        );

        return (
            <div className="file-tree">
                {rootFolders.map((folder) =>
                    renderFolder(folder, 0)
                )}

                {sortFiles(tree.files).map((file) =>
                    renderFile(file, 0)
                )}

                {rootFolders.length === 0 &&
                    tree.files.length === 0 && (
                        <div className="file-tree-empty">
                            No files yet
                        </div>
                    )}
            </div>
        );
    }

    /*
     * =========================
     * LINE NUMBERS
     * =========================
     */

    function renderLineNumbers() {
        const lineCount =
            fileContent.length === 0
                ? 1
                : fileContent.split("\n").length;

        return Array.from(
            { length: lineCount },
            (_, index) => (
                <span key={index}>
                    {index + 1}
                </span>
            )
        );
    }

    return (
        <div className="forgeai-app">

            <header className="topbar">

                <div className="brand">

                    <div className="brand-mark">
                        F
                    </div>

                    <div>
                        <div className="brand-name">
                            ForgeAI
                        </div>

                        <div className="brand-subtitle">
                            Autonomous AI Engineer
                        </div>
                    </div>

                </div>

                <div className="project-name">

                    <button
                        className="back-to-projects"
                        onClick={onBackToDashboard}
                        title="Back to projects"
                    >
                        ←
                    </button>

                    <span className="status-dot"></span>

                    {projectName}

                </div>

                <div className="topbar-actions">

                    <span className="agent-status">

                        <span className="status-dot"></span>

                        Agent Ready

                    </span>

                    <button
                        className="icon-button"
                        title="Settings"
                    >
                        ⚙
                    </button>

                </div>

            </header>

            <main
                className="workspace"
                style={{
                    "--sidebar-width": `${sidebarWidth}px`,
                    "--agent-width": `${agentWidth}px`,
                }}
            >

                <aside className="sidebar">

                    <div className="sidebar-section">

                        <div className="sidebar-heading">
                            <span>
                                WORKSPACE
                            </span>
                        </div>

                        <button
                            className="new-project-button"
                            onClick={onBackToDashboard}
                        >
                            <span>+</span>
                            Projects
                        </button>

                    </div>

                    <div className="sidebar-section project-section">

                        <div className="sidebar-heading project-heading">

                            <span>
                                PROJECT
                            </span>

                            <div className="project-create-wrapper">
                                <button
                                    className="small-icon-button"
                                    title="Create file or folder"
                                    onClick={() => setShowCreateMenu((current) => !current)}
                                    disabled={creatingItem}
                                >
                                    +
                                </button>

                                {showCreateMenu && (
                                    <div className="project-create-menu">
                                        <button
                                            type="button"
                                            onClick={() => handleCreateProjectItem("file")}
                                        >
                                            <span>📄</span>
                                            <span>New File</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleCreateProjectItem("folder")}
                                        >
                                            <span>📁</span>
                                            <span>New Folder</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>

                        {renderFileTree()}

                    </div>

                    <div className="sidebar-bottom">

                        <div className="sidebar-user">

                            <div className="avatar">

                                {(
                                    user?.name ||
                                    user?.email ||
                                    "U"
                                )
                                    .charAt(0)
                                    .toUpperCase()}

                            </div>

                            <div className="user-info">

                                <span className="user-name">
                                    {user?.name ||
                                        user?.email ||
                                        "Developer"}
                                </span>

                                <span className="user-role">
                                    ForgeAI Workspace
                                </span>

                            </div>

                            <button
                                className="small-icon-button"
                                title="Sign out"
                                onClick={onLogout}
                            >
                                ↪
                            </button>

                        </div>

                    </div>

                </aside>

                <div
                    className="panel-resizer panel-resizer-horizontal"
                    onMouseDown={(event) =>
                        startPanelResize(
                            "sidebar",
                            event
                        )
                    }
                    title="Resize project panel"
                />

                <section className="editor-panel"
                        ref={editorPanelRef}>

                    <div className="editor-tabs">

                        <div className="editor-tab active">

                            <span className="tab-icon">
                                {activeFile
                                    ? getFileIcon(
                                          activeFile.path
                                      )
                                    : "◇"}
                            </span>

                            {activeFile
                                ? activeFile.path
                                : "No file selected"}

                            {hasUnsavedChanges && (
                                <span
                                    className="unsaved-indicator"
                                    title="Unsaved changes"
                                >
                                    ●
                                </span>
                            )}

                            <span className="tab-close">
                                ×
                            </span>

                        </div>

                    </div>

                    <div className="editor-toolbar">

                        <div className="breadcrumb">

                            <span>
                                {activeFile
                                    ? getDirectory(
                                          activeFile.path
                                      )
                                    : "root"}
                            </span>

                            <span>/</span>

                            <strong>
                                {activeFile
                                    ? getFileName(
                                          activeFile.path
                                      )
                                    : "No file"}
                            </strong>

                        </div>

                        <div className="editor-actions">

                            {saveMessage && (
                                <span className="save-message">
                                    {saveMessage}
                                </span>
                            )}

                            <button
                                className="editor-action"
                                onClick={handleExportProject}
                                disabled={exporting}
                                title="Download this project as a ZIP"
                            >
                                {exporting ? "Exporting..." : "Export ZIP"}
                            </button>

                            <button
                                className="editor-action"
                                onClick={handleRunFile}
                                disabled={
                                    !activeFile ||
                                    running ||
                                    loadingFile
                                }
                            >
                                {running ? "Running..." : "Run"}
                            </button>

                            <button
                                className="editor-action primary"
                                onClick={
                                    handleSaveFile
                                }
                                disabled={
                                    !activeFile ||
                                    saving ||
                                    !hasUnsavedChanges
                                }
                            >
                                {saving
                                    ? "Saving..."
                                    : hasUnsavedChanges
                                    ? "Save"
                                    : "Saved"}
                            </button>

                        </div>

                    </div>

                    {error && (
                        <div className="editor-error">
                            {error}
                        </div>
                    )}

                    <div className="code-editor">

                        {loadingFile ? (
                            <div className="editor-loading">
                                Loading file...
                            </div>
                        ) : !activeFile ? (
                            <div className="editor-empty">

                                <div className="editor-empty-icon">
                                    F
                                </div>

                                <h3>
                                    No file selected
                                </h3>

                                <p>
                                    Select a project file
                                    from the sidebar.
                                </p>

                            </div>
                        ) : (
                            <>
                                <div className="line-numbers">
                                    {renderLineNumbers()}
                                </div>

                                <Editor
                                  height="100%"
                                  width="100%"
                                  theme="vs-dark"
                                  language={getEditorLanguage(
                                      activeFile.path
                                  )}
                                  path={activeFile.path}
                                  value={fileContent}
                                  onChange={(value) =>
                                      setFileContent(value ?? "")
                                  }
                                  onMount={(editor, monaco) => {
                                    editor.addAction({
                                        id: "forgeai-save-file",
                                        label: "Save File",
                                        keybindings: [
                                            monaco.KeyMod.CtrlCmd |
                                                monaco.KeyCode.KeyS,
                                        ],
                                        run: () => {
                                            saveFileRef.current?.();
                                        },
                                    });
                                }}
                                  options={{
                                      automaticLayout: true,
                                      fontSize: 13,
                                      fontFamily:
                                          "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
                                      lineHeight: 21,
                                      minimap: {
                                          enabled: false,
                                      },
                                      padding: {
                                          top: 14,
                                          bottom: 14,
                                      },
                                      scrollBeyondLastLine: false,
                                      smoothScrolling: true,
                                      cursorBlinking: "smooth",
                                      renderWhitespace: "selection",
                                      wordWrap: "off",
                                      tabSize: 4,
                                      insertSpaces: true,
                                      folding: true,
                                      lineNumbers: "on",
                                      roundedSelection: false,
                                      automaticLayout: true,
                                      suggestOnTriggerCharacters: true,
                                  }}
                              />
                            </>
                        )}

                    </div>

                        {executionResult && (
                            <>
                                <div
                                    className="panel-resizer panel-resizer-vertical"
                                    onMouseDown={(event) =>
                                        startPanelResize(
                                            "output",
                                            event
                                        )
                                    }
                                    title="Resize output panel"
                                />

                                <div
                                    className="execution-panel"
                                    style={{
                                        height: `${outputHeight}px`,
                                    }}
                                >
                                <div className="execution-header">
                                    <div className="execution-header-left">
                                        <span>OUTPUT</span>

                                        <span
                                            className={
                                                executionResult?.success === true
                                                    ? "execution-success"
                                                    : "execution-failure"
                                            }
                                        >
                                            {executionResult?.success === true
                                                ? "SUCCESS"
                                                : "FAILED"}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        className="execution-close"
                                        onClick={() => setExecutionResult(null)}
                                        title="Close output"
                                        aria-label="Close output"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="execution-body">
                                    {executionResult?.build && (
                                        <>
                                            <div className="execution-section-title">
                                                BUILD
                                            </div>

                                            {executionResult.build.stdout && (
                                                <pre className="execution-stdout">
                                                    {executionResult.build.stdout}
                                                </pre>
                                            )}

                                            {executionResult.build.stderr && (
                                                <pre className="execution-stderr">
                                                    {executionResult.build.stderr}
                                                </pre>
                                            )}
                                        </>
                                    )}

                                    {executionResult?.execution && (
                                        <>
                                            <div className="execution-section-title">
                                                EXECUTION
                                            </div>

                                            {executionResult.execution.stdout && (
                                                <pre className="execution-stdout">
                                                    {executionResult.execution.stdout}
                                                </pre>
                                            )}

                                            {executionResult.execution.stderr && (
                                                <pre className="execution-stderr">
                                                    {executionResult.execution.stderr}
                                                </pre>
                                            )}

                                            {!executionResult.execution.stdout &&
                                                !executionResult.execution.stderr && (
                                                    <pre className="execution-stdout">
                                                        No output.
                                                    </pre>
                                                )}
                                        </>
                                    )}

                                    {!executionResult?.execution &&
                                        executionResult?.stderr && (
                                            <pre className="execution-stderr">
                                                {executionResult.stderr}
                                            </pre>
                                        )}
                                </div>
                            </div>
                        </>    
                    )}

                    <div className="editor-statusbar">

                        <span>
                            {activeFile
                                ? activeFile.path.endsWith(".java")
                                    ? "Java"
                                    : activeFile.path.endsWith(".py")
                                        ? "Python"
                                        : activeFile.path.endsWith(".js")
                                            ? "JavaScript"
                                            : activeFile.path.endsWith(".jsx")
                                                ? "JavaScript React"
                                                : activeFile.path.endsWith(".ts")
                                                    ? "TypeScript"
                                                    : activeFile.path.endsWith(".tsx")
                                                        ? "TypeScript React"
                                                        : activeFile.path.endsWith(".json")
                                                            ? "JSON"
                                                            : activeFile.path.endsWith(".css")
                                                                ? "CSS"
                                                                : activeFile.path.endsWith(".html")
                                                                    ? "HTML"
                                                                    : activeFile.path.endsWith(".c")
                                                                        ? "C"
                                                                        : activeFile.path.endsWith(".cpp")
                                                                            ? "C++"
                                                                            : activeFile.path.endsWith(".rs")
                                                                                ? "Rust"
                                                                                : "Plain Text"
                                : "No file"}
                        </span>

                        <span>
                            UTF-8
                        </span>

                        <span>
                            LF
                        </span>

                    </div>

                </section>

                <div
                    className="panel-resizer panel-resizer-horizontal"
                    onMouseDown={(event) =>
                        startPanelResize(
                            "agent",
                            event
                        )
                    }
                    title="Resize agent panel"
                />

                <aside className="agent-panel">

                    <div className="agent-header">

                        <div>

                            <div className="agent-title">
                                ForgeAI Agent
                            </div>

                            <div className="agent-subtitle">
                                Autonomous software engineer
                            </div>

                        </div>

                        <div className="agent-header-actions">
                            <button
                                className="new-conversation-button"
                                onClick={handleNewConversation}
                                disabled={sendingMessage}
                                title="Start a new conversation"
                            >
                                + New chat
                            </button>

                            <div className="agent-indicator">
                                <span></span>
                            </div>
                        </div>

                    </div>

                    {conversations.length > 1 && (
                        <div className="conversation-history">
                            <label htmlFor="conversation-select">Conversation</label>
                            <select
                                id="conversation-select"
                                value={conversationId || ""}
                                onChange={(event) =>
                                    loadConversation(
                                        project.id,
                                        event.target.value
                                    )
                                }
                                disabled={sendingMessage}
                            >
                                {conversations.map((conversation) => (
                                    <option
                                        key={conversation.id}
                                        value={conversation.id}
                                    >
                                        {conversation.title || "Untitled conversation"}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="conversation">

                        {loadingConversation ? (
                            <div className="conversation-loading">
                                Loading conversation...
                            </div>
                        ) : conversationMessages.length === 0 ? (
                            <>
                                <div className="welcome-message">

                                    <div className="forgeai-avatar">
                                        F
                                    </div>

                                    <div className="message-content">

                                        <div className="message-author">
                                            ForgeAI
                                        </div>

                                        <p>
                                            I'm ready to build, modify, test, and debug your project.
                                        </p>

                                        <p>
                                            Tell me what you want to create.
                                        </p>

                                    </div>

                                </div>

                                <div className="suggestions">

                                    <button
                                        onClick={() =>
                                            setMessage(
                                                "Build a modern landing page"
                                            )
                                        }
                                    >
                                        <span>✦</span>
                                        Build a modern landing page
                                    </button>

                                    <button
                                        onClick={() =>
                                            setMessage(
                                                "Find and fix bugs in my project"
                                            )
                                        }
                                    >
                                        <span>⌁</span>
                                        Find and fix bugs
                                    </button>

                                    <button
                                        onClick={() =>
                                            setMessage(
                                                "Add authentication to my app"
                                            )
                                        }
                                    >
                                        <span>+</span>
                                        Add authentication
                                    </button>

                                </div>
                            </>
                        ) : (
                            <div className="conversation-messages">
                                {conversationMessages.map((chatMessage) => (
                                    <div
                                        className={`chat-message ${
                                            chatMessage.role === "user"
                                                ? "chat-message-user"
                                                : "chat-message-assistant"
                                        }`}
                                        key={chatMessage.id}
                                    >
                                        <div className="chat-message-avatar">
                                            {chatMessage.role === "user" ? "You" : "F"}
                                        </div>

                                        <div className="chat-message-body">
                                            <div className="chat-message-author">
                                                {chatMessage.role === "user" ? "You" : "ForgeAI"}
                                            </div>
                                            <div className="chat-message-content">
                                                {chatMessage.content || ""}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {sendingMessage && (
                                    <div className="chat-message chat-message-assistant">
                                        <div className="chat-message-avatar">F</div>
                                        <div className="chat-message-body">
                                            <div className="chat-message-author">ForgeAI</div>
                                            <div className="chat-message-content agent-working-message">
                                                ForgeAI is working on your project…
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={conversationEndRef} />
                            </div>
                        )}

                    </div>

                    <div className="agent-input-area">

                        {agentError && (
                            <div className="agent-error">
                                {agentError}
                            </div>
                        )}   

                        <div className="agent-input-wrapper">

                            <textarea
                                value={message}
                                onChange={(event) =>
                                    setMessage(
                                        event.target.value
                                    )
                                }
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Enter" &&
                                        !event.shiftKey
                                    ) {
                                        event.preventDefault();
                                        handleSendMessage();
                                    }
                                }}
                                placeholder="Ask ForgeAI to build something..."
                                rows="3"
                                disabled={sendingMessage}
                            />

                            <div className="input-footer">

                                <span className="input-hint">
                                    ForgeAI can modify and
                                    test your code
                                </span>

                                <button
                                    className="send-button"
                                      onClick={handleSendMessage}
                                      disabled={
                                          !message.trim() ||
                                          sendingMessage
                                      }
                                      title={
                                          sendingMessage
                                              ? "ForgeAI is working..."
                                              : "Send message"
                                      }
                                  >
                                      {sendingMessage ? "…" : "↑"}
                                </button>

                            </div>

                        </div>

                    </div>

                </aside>

            </main>

        </div>
    );
}

/* =========================
   APP
========================= */

function App() {
    const [user, setUser] = useState(null);
    const [project, setProject] = useState(null);

    const [loading, setLoading] =
        useState(true);

    useEffect(() => {
        async function loadCurrentUser() {
            try {
                const response =
                    await getCurrentUser();

                const authenticatedUser =
                    response?.user ||
                    response?.data?.user ||
                    response?.data ||
                    response;

                setUser(authenticatedUser);

                const savedProjectId =
                    window.sessionStorage.getItem(
                        "forgeai_active_project_id"
                    );

                if (savedProjectId) {
                    try {
                        const projectsResponse =
                            await getProjects();

                        const savedProject =
                            (
                                projectsResponse?.projects ||
                                []
                            ).find(
                                (item) =>
                                    item.id ===
                                    savedProjectId
                            );

                        if (savedProject) {
                            setProject(savedProject);
                        } else {
                            window.sessionStorage.removeItem(
                                "forgeai_active_project_id"
                            );
                        }
                    } catch {
                        window.sessionStorage.removeItem(
                            "forgeai_active_project_id"
                        );
                    }
                }
            } catch {
                setUser(null);
            } finally {
                setLoading(false);
            }
        }

        loadCurrentUser();
    }, []);

    async function handleLogout() {
        try {
            await logoutUser();
        } finally {
            window.sessionStorage.removeItem(
                "forgeai_active_project_id"
            );
            setUser(null);
            setProject(null);
        }
    }

    function handleAuthenticated(response) {
        const authenticatedUser =
            response?.user ||
            response?.data?.user ||
            response?.data ||
            response;

        setUser(authenticatedUser);
    }

    function handleOpenProject(selectedProject) {
        setProject(selectedProject);

        window.sessionStorage.setItem(
            "forgeai_active_project_id",
            selectedProject.id
        );
    }

    function handleBackToDashboard() {
        window.sessionStorage.removeItem(
            "forgeai_active_project_id"
        );

        setProject(null);
    }

    if (loading) {
        return (
            <div className="auth-loading">

                <div className="loading-mark">
                    F
                </div>

                <div className="loading-text">
                    Loading ForgeAI...
                </div>

            </div>
        );
    }

    if (!user) {
        return (
            <AuthScreen
                onAuthenticated={
                    handleAuthenticated
                }
            />
        );
    }

    if (!project) {
        return (
            <ProjectDashboard
                user={user}
                onOpenProject={
                    handleOpenProject
                }
                onLogout={handleLogout}
            />
        );
    }

    return (
        <Workspace
            user={user}
            project={project}
            onLogout={handleLogout}
            onBackToDashboard={
                handleBackToDashboard
            }
        />
    );
}

export default App;