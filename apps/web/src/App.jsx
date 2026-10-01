import { useState } from "react";
import "./App.css";

const initialFiles = [
    { name: "src", type: "folder", open: true },
    { name: "App.jsx", type: "file", path: "src/App.jsx" },
    { name: "main.jsx", type: "file", path: "src/main.jsx" },
    { name: "index.css", type: "file", path: "src/index.css" },
    { name: "package.json", type: "file", path: "package.json" },
];

function App() {
    const [activeFile, setActiveFile] = useState("src/App.jsx");
    const [message, setMessage] = useState("");

    return (
        <div className="forgeai-app">
            {/* Top Bar */}
            <header className="topbar">
                <div className="brand">
                    <div className="brand-mark">F</div>

                    <div>
                        <div className="brand-name">ForgeAI</div>
                        <div className="brand-subtitle">
                            Autonomous AI Engineer
                        </div>
                    </div>
                </div>

                <div className="project-name">
                    <span className="status-dot"></span>
                    ForgeAI Project
                </div>

                <div className="topbar-actions">
                    <span className="agent-status">
                        <span className="status-dot"></span>
                        Agent Ready
                    </span>

                    <button className="icon-button" title="Settings">
                        ⚙
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <main className="workspace">

                {/* Sidebar */}
                <aside className="sidebar">
                    <div className="sidebar-section">
                        <div className="sidebar-heading">
                            <span>WORKSPACE</span>
                        </div>

                        <button className="new-project-button">
                            <span>+</span>
                            New Project
                        </button>
                    </div>

                    <div className="sidebar-section project-section">
                        <div className="sidebar-heading project-heading">
                            <span>PROJECT</span>

                            <button className="small-icon-button">
                                +
                            </button>
                        </div>

                        <div className="file-tree">

                            <div className="tree-item folder">
                                <span className="tree-icon">⌄</span>
                                <span>src</span>
                            </div>

                            <button
                                className={`tree-item file ${
                                    activeFile === "src/App.jsx"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setActiveFile("src/App.jsx")
                                }
                            >
                                <span className="tree-icon">◇</span>
                                <span>App.jsx</span>
                            </button>

                            <button
                                className={`tree-item file ${
                                    activeFile === "src/main.jsx"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setActiveFile("src/main.jsx")
                                }
                            >
                                <span className="tree-icon">◇</span>
                                <span>main.jsx</span>
                            </button>

                            <button
                                className={`tree-item file ${
                                    activeFile === "src/index.css"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setActiveFile("src/index.css")
                                }
                            >
                                <span className="tree-icon">◇</span>
                                <span>index.css</span>
                            </button>

                            <button
                                className={`tree-item file ${
                                    activeFile === "package.json"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setActiveFile("package.json")
                                }
                            >
                                <span className="tree-icon">◇</span>
                                <span>package.json</span>
                            </button>

                        </div>
                    </div>

                    <div className="sidebar-bottom">
                        <div className="sidebar-user">
                            <div className="avatar">A</div>

                            <div className="user-info">
                                <span className="user-name">Developer</span>
                                <span className="user-role">
                                    ForgeAI Workspace
                                </span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Editor */}
                <section className="editor-panel">

                    <div className="editor-tabs">
                        <div className="editor-tab active">
                            <span className="tab-icon">◇</span>
                            {activeFile}
                            <span className="tab-close">×</span>
                        </div>
                    </div>

                    <div className="editor-toolbar">
                        <div className="breadcrumb">
                            <span>src</span>
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
                        <span>JavaScript React</span>
                        <span>UTF-8</span>
                        <span>LF</span>
                    </div>

                </section>

                {/* Agent Panel */}
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
                                    I'm ready to build, modify, test,
                                    and debug your project.
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

                    </div>

                    <div className="agent-input-area">

                        <div className="agent-input-wrapper">
                            <textarea
                                value={message}
                                onChange={(event) =>
                                    setMessage(event.target.value)
                                }
                                placeholder="Ask ForgeAI to build something..."
                                rows="3"
                            />

                            <div className="input-footer">
                                <span className="input-hint">
                                    ForgeAI can modify and test your code
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

export default App;