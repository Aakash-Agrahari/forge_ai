import { useEffect, useState } from "react";
import "./App.css";

import {
    getCurrentUser,
    loginUser,
    registerUser,
    logoutUser,
    getProjects,
    createProject,
    deleteProject,
    getProjectFiles,
    getProjectFile,
    updateProjectFile,
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

                <div className="dashboard-title-row">

                    <div>

                        <div className="dashboard-eyebrow">
                            WORKSPACE
                        </div>

                        <h1>
                            Your Projects
                        </h1>

                        <p>
                            Build, modify, and ship
                            applications with ForgeAI.
                        </p>

                    </div>

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
    const [activeFileId, setActiveFileId] = useState(null);
    const [activeFile, setActiveFile] = useState(null);

    const [fileContent, setFileContent] = useState("");
    const [originalContent, setOriginalContent] = useState("");

    const [loadingFiles, setLoadingFiles] = useState(true);
    const [loadingFile, setLoadingFile] = useState(false);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [saveMessage, setSaveMessage] = useState("");

    const [message, setMessage] = useState("");

    const projectName =
        project?.name || "ForgeAI Project";

    /*
     * =========================
     * LOAD PROJECT FILES
     * =========================
     */

    useEffect(() => {
        let cancelled = false;

        async function loadFiles() {
            if (!project?.id) {
                return;
            }

            setLoadingFiles(true);
            setError("");
            setSaveMessage("");

            try {
                const response =
                    await getProjectFiles(project.id);

                if (cancelled) {
                    return;
                }

                const projectFiles =
                    response?.files || [];

                setFiles(projectFiles);

                if (projectFiles.length > 0) {
                    setActiveFileId(
                        projectFiles[0].id
                    );
                } else {
                    setActiveFileId(null);
                    setActiveFile(null);
                    setFileContent("");
                    setOriginalContent("");
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(
                        requestError.message ||
                        "Unable to load project files."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingFiles(false);
                }
            }
        }

        loadFiles();

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

    /*
     * =========================
     * RENDER FILE TREE
     * =========================
     */

    function renderFileTree() {
        if (loadingFiles) {
            return (
                <div className="file-tree-status">
                    Loading files...
                </div>
            );
        }

        if (files.length === 0) {
            return (
                <div className="file-tree-status">
                    This project has no files yet.
                </div>
            );
        }

        const sortedFiles = [...files].sort(
            (a, b) =>
                a.path.localeCompare(b.path)
        );

        return (
            <div className="file-tree">
                {sortedFiles.map((file) => {
                    const isActive =
                        file.id === activeFileId;

                    return (
                        <button
                            key={file.id}
                            className={`tree-item file ${
                                isActive
                                    ? "active"
                                    : ""
                            }`}
                            onClick={() =>
                                setActiveFileId(file.id)
                            }
                            title={file.path}
                        >
                            <span className="tree-icon">
                                {getFileIcon(
                                    file.path
                                )}
                            </span>

                            <span className="tree-file-content">
                                <span className="tree-file-name">
                                    {getFileName(
                                        file.path
                                    )}
                                </span>

                                {getDirectory(
                                    file.path
                                ) !== "root" && (
                                    <span className="tree-file-directory">
                                        {getDirectory(
                                            file.path
                                        )}
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })}
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

            <main className="workspace">

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

                            <button
                                className="small-icon-button"
                                title="Create file"
                            >
                                +
                            </button>

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

                <section className="editor-panel">

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
                                disabled={!activeFile}
                            >
                                Run
                            </button>

                            <button
                                className="editor-action primary"
                                onClick={
                                    handleSaveFile
                                }
                                disabled={
                                    !activeFile ||
                                    saving ||
                                    fileContent ===
                                        originalContent
                                }
                            >
                                {saving
                                    ? "Saving..."
                                    : "Save"}
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

                                <textarea
                                    className="code-textarea"
                                    value={fileContent}
                                    onChange={(event) =>
                                        setFileContent(
                                            event.target
                                                .value
                                        )
                                    }
                                    onKeyDown={
                                        handleEditorKeyDown
                                    }
                                    spellCheck={false}
                                    aria-label={`Editing ${activeFile.path}`}
                                />
                            </>
                        )}

                    </div>

                    <div className="editor-statusbar">

                        <span>
                            {activeFile
                                ? activeFile.path.endsWith(
                                      ".json"
                                  )
                                    ? "JSON"
                                    : activeFile.path.endsWith(
                                            ".css"
                                        )
                                      ? "CSS"
                                      : activeFile.path.endsWith(
                                              ".jsx"
                                          )
                                        ? "JavaScript React"
                                        : "JavaScript"
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

                        <div className="agent-indicator">
                            <span></span>
                        </div>

                    </div>

                    <div className="conversation">

                        <div className="welcome-message">

                            <div className="forgeai-avatar">
                                F
                            </div>

                            <div className="message-content">

                                <div className="message-author">
                                    ForgeAI
                                </div>

                                <p>
                                    I'm ready to build,
                                    modify, test, and
                                    debug your project.
                                </p>

                                <p>
                                    Tell me what you want
                                    to create.
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

                    </div>

                    <div className="agent-input-area">

                        <div className="agent-input-wrapper">

                            <textarea
                                value={message}
                                onChange={(event) =>
                                    setMessage(
                                        event.target.value
                                    )
                                }
                                placeholder="Ask ForgeAI to build something..."
                                rows="3"
                            />

                            <div className="input-footer">

                                <span className="input-hint">
                                    ForgeAI can modify and
                                    test your code
                                </span>

                                <button className="send-button">
                                    ↑
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
    }

    function handleBackToDashboard() {
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