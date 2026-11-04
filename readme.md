# ForgeAI

> An autonomous, multi-model AI coding workspace that builds, modifies, tests, versions, and exports software projects from natural-language instructions.

**Live Deployed Link:** [deployed link here](https://your-deployed-link-here)

---

## Overview

ForgeAI is an AI-powered software development platform inspired by tools such as Codex and Claude Code. Users describe what they want to build, and ForgeAI plans the work, generates or modifies code, runs tools, builds and tests the application, repairs errors, and maintains the project for future improvements.

Projects persist in a workspace, so users can return later, continue development, review versions, and export their work as ZIP files. Users can also upload an existing ZIP project and continue working on it.

## Key Features

- **AI coding agent:** Understands natural-language requests, creates plans, edits files, executes tools, and iterates through build and test failures.
- **Multi-model routing:** Uses a provider/model gateway to select suitable models and switch providers when a legitimate free quota or service becomes unavailable.
- **Real-time collaboration:** Project owners can share a collaboration link with others. The owner and invited collaborators join the same room and edit project files together in real time without refreshing. Collaboration uses **Yjs** for synchronized document updates and **WebSockets** for communication.
- **Persistent workspaces:** Projects and files remain available across sessions, supporting ongoing development rather than regenerating applications from scratch.
- **Project versioning:** Maintains project history and supports version-based workflows, with Git integration where appropriate.
- **Build and testing workflow:** Runs controlled commands, builds, tests, detects errors, and supports agent-driven repair.
- **ZIP import and export:** Download project artifacts and upload existing projects to continue development.
- **User accounts and access control:** Secure sessions, user-owned projects, and authorization checks protect project access.
- **Code editor and workspace UI:** React interface with Monaco Editor, file explorer, agent interaction, terminal/build output, and live preview.

## How It Works

```text
User prompt or uploaded project
              |
              v
       Project workspace
              |
              v
          AI agent
              |
       Plan and select model
              |
              v
       Generate / edit code
              |
              v
       Execute tools
              |
              v
        Build and test
          /       \
       Failed     Passed
         |           |
     Repair loop     v
         |       New version
         |           |
         +------> ZIP export
```

For collaboration, the project owner creates a share link and both the owner and collaborators join the same Yjs collaboration room. Document updates are exchanged through the WebSocket server and synchronized across connected editors.

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript, ES Modules |
| Code editor | Monaco Editor |
| Backend | Node.js, Express, JavaScript, ES Modules |
| Database / ORM | PostgreSQL, Prisma |
| Real-time collaboration | Yjs, WebSockets (`ws`) |
| AI | Multi-provider model gateway, model router, Ollama/local models |
| Sandbox and execution | Isolated execution environment; Docker is a planned option |
| Browser verification | Playwright (planned) |
| Testing | Vitest, Supertest |
| Code quality | ESLint, Prettier |
| Supporting infrastructure | Redis for caching, sessions, rate limiting, and queues (planned) |

## AI Model Strategy

ForgeAI is designed not to depend on a single provider. The model gateway provides a common interface for provider selection, credentials, retries, timeouts, rate limits, quota tracking, health checks, failover, and usage accounting.

Potential providers and model sources include:

- Google Gemini
- Groq
- Cerebras
- OpenRouter free models
- Mistral
- SambaNova
- Cloudflare Workers AI
- GitHub Models
- Hugging Face
- NVIDIA-hosted model options
- Z.AI
- Cohere
- Local models through Ollama

Provider access, free quotas, terms, and model availability can change. ForgeAI must use providers legitimately and must never bypass quotas or silently switch to paid usage. If free capacity is exhausted and no local model is available, the task should pause or queue and the user should be informed. User-provided API keys may be supported where provider terms permit; keys must be protected server-side and encrypted at rest.

## Real-Time Collaboration

ForgeAI supports shared project editing:

1. The project owner creates a collaboration room and shares its link.
2. The owner and collaborators join that same room.
3. Each editor synchronizes file content through Yjs documents.
4. WebSocket messages distribute document updates to other connected participants.
5. Project access is checked using the authenticated session and collaboration permissions.

The owner must join the collaboration room as well as the invited collaborators; creating a share link alone does not subscribe the owner to live updates.

## Security

Security is a core design requirement:

- Hash passwords; never store plaintext passwords.
- Use server-side sessions and secure, HttpOnly cookies.
- Apply authentication and authorization checks to protected resources.
- Verify project ownership or explicit collaboration permission on every project operation.
- Validate request data, file paths, uploaded archives, tool arguments, and model output.
- Keep API keys, credentials, session secrets, and other sensitive values out of logs and ZIP exports.
- Restrict file access to the authorized project workspace.
- Treat prompts, project files, terminal output, web pages, and generated code as untrusted input.
- Apply rate limits, execution timeouts, and resource restrictions.
- Do not execute generated code directly on the API host; use an appropriately isolated execution environment.
- Do not assume Docker alone provides complete isolation.
- Never automatically incur paid AI usage without the user's explicit consent.

## Project Workspace and Data

Each user has their own projects. A project can contain files, versions, agent runs, tasks, artifacts, and workspace metadata. The workspace is the source of truth; a ZIP is an export artifact.

Example:

```text
User
 ├── Project A
 │    ├── Files / Workspace
 │    ├── Versions
 │    ├── Agent Runs and Tasks
 │    └── Artifacts
 └── Project B
      └── ...
```

The agent should send only relevant project context to a model rather than the entire codebase on every request. Context can include the project summary, relevant files, recent changes, current errors, and task state.

## Repository Structure

The repository is organized as a monorepo:

```text
forge-ai/
├── apps/
│   ├── api/             # Express API and backend services
│   └── web/             # React + Vite frontend
├── packages/
│   ├── shared/
│   ├── validation/
│   └── model-sdk/
├── infrastructure/
│   ├── docker/
│   └── deployment/
├── prisma/
│   └── schema.prisma
├── tests/
├── .env.example
├── package.json
└── README.md
```

The exact structure may evolve as the implementation grows.

## Local Development

### Prerequisites

- Node.js
- PostgreSQL
- Git
- Provider API keys for the AI models you want to use
- Ollama, if you want to run supported local models

Redis and Docker are part of the planned infrastructure where needed.

### Setup

```bash
git clone <repository-url>
cd forge-ai
npm install
```

Configure the environment using `.env.example`, then start the API and frontend using the scripts defined in the root and workspace `package.json` files.

Typical environment variables include:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=
SESSION_SECRET=

GEMINI_API_KEY=
GROQ_API_KEY=
CEREBRAS_API_KEY=
OPENROUTER_API_KEY=

OLLAMA_BASE_URL=
```

Use the actual variable names required by your current configuration. Never commit real `.env` files or credentials.

## Development Principles

ForgeAI is built incrementally with a production-oriented mindset:

- Understand the requirement before implementation.
- Prefer modular, replaceable services.
- Test changes after each major milestone.
- Treat AI output and generated code as untrusted.
- Preserve project state and version history.
- Handle provider failures and free-tier limits gracefully.
- Keep user data isolated and collaboration access controlled.
- Avoid unnecessary infrastructure until it is needed.

## Roadmap

The broader roadmap includes:

- Strengthen authentication, authorization, and account recovery.
- Expand project, version, import, and export workflows.
- Improve model registry, quota-aware routing, failover, and local model support.
- Continue improving agent planning, context selection, tool execution, and repair loops.
- Harden isolated code execution and resource controls.
- Expand browser-based application verification and testing.
- Improve deployment, monitoring, backups, performance, and scalability.
- Continue enhancing real-time collaboration and the overall AI IDE experience.

Some infrastructure and capabilities described above are planned or subject to further hardening; the technology table identifies planned components where relevant.

## Project Principles and Non-Goals

ForgeAI aims for a zero-budget development and initial deployment approach by prioritizing open-source tools, local development, free hosting tiers, and legitimate free AI capacity. Free services have limits, and unlimited free inference is not guaranteed.

ForgeAI does not aim to train an LLM from scratch, bypass provider quotas, create fake accounts to multiply quotas, provide unrestricted server-side code execution, or silently use paid APIs.

## License

Add your chosen license and licensing terms here.
