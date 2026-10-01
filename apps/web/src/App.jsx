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
                            <button
                                key={project.id}
                                className="project-card"
                                onClick={() =>
                                    onOpenProject(project)
                                }
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

                            </button>
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
}) {
    const [activeFile, setActiveFile] =
        useState("src/App.jsx");

    const [message, setMessage] =
        useState("");

    const projectName =
        project?.name || "ForgeAI Project";

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

                        <button className="new-project-button">
                            <span>+</span>
                            New Project
                        </button>

                    </div>

                    <div className="sidebar-section project-section">

                        <div className="sidebar-heading project-heading">

                            <span>
                                PROJECT
                            </span>

                            <button className="small-icon-button">
                                +
                            </button>

                        </div>

                        <div className="file-tree">

                            <div className="tree-item folder">

                                <span className="tree-icon">
                                    ⌄
                                </span>

                                <span>
                                    src
                                </span>

                            </div>

                            <button
                                className={`tree-item file ${
                                    activeFile ===
                                    "src/App.jsx"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setActiveFile(
                                        "src/App.jsx"
                                    )
                                }
                            >
                                <span className="tree-icon">
                                    ◇
                                </span>

                                <span>
                                    App.jsx
                                </span>

                            </button>

                            <button
                                className={`tree-item file ${
                                    activeFile ===
                                    "src/main.jsx"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setActiveFile(
                                        "src/main.jsx"
                                    )
                                }
                            >
                                <span className="tree-icon">
                                    ◇
                                </span>

                                <span>
                                    main.jsx
                                </span>

                            </button>

                            <button
                                className={`tree-item file ${
                                    activeFile ===
                                    "src/index.css"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setActiveFile(
                                        "src/index.css"
                                    )
                                }
                            >
                                <span className="tree-icon">
                                    ◇
                                </span>

                                <span>
                                    index.css
                                </span>

                            </button>

                            <button
                                className={`tree-item file ${
                                    activeFile ===
                                    "package.json"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setActiveFile(
                                        "package.json"
                                    )
                                }
                            >
                                <span className="tree-icon">
                                    ◇
                                </span>

                                <span>
                                    package.json
                                </span>

                            </button>

                        </div>

                    </div>

                    <div className="sidebar-bottom">

                        <div className="sidebar-user">

                            <div className="avatar">

                                {(user?.name ||
                                    user?.email ||
                                    "U")
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
                                ◇
                            </span>

                            {activeFile}

                            <span className="tab-close">
                                ×
                            </span>

                        </div>

                    </div>

                    <div className="editor-toolbar">

                        <div className="breadcrumb">

                            <span>
                                {activeFile.includes("/")
                                    ? activeFile.split("/")[0]
                                    : "root"}
                            </span>

                            <span>/</span>

                            <strong>
                                {activeFile.split("/").pop()}
                            </strong>

                        </div>

                        <div className="editor-actions">

                            <button className="editor-action">
                                Run
                            </button>

                            <button className="editor-action primary">
                                Save
                            </button>

                        </div>

                    </div>

                    <div className="code-editor">

                        <div className="line-numbers">

                            {Array.from(
                                { length: 18 },
                                (_, index) => (
                                    <span key={index}>
                                        {index + 1}
                                    </span>
                                )
                            )}

                        </div>

                        <pre className="code-content">

                            <code>
{`import { useState } from "react";

function App() {
    const [count, setCount] = useState(0);

    return (
        <main>
            <h1>Welcome to ForgeAI</h1>

            <p>
                Build applications with
                your autonomous AI engineer.
            </p>

            <button
                onClick={() => setCount(count + 1)}
            >
                Count: {count}
            </button>
        </main>
    );
}

export default App;`}
                            </code>

                        </pre>

                    </div>

                    <div className="editor-statusbar">

                        <span>
                            JavaScript React
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