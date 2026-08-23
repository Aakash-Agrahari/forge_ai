# ForgeAI

> An autonomous, multi-model AI coding agent that builds, modifies, tests, versions, and exports software projects from natural-language instructions.

---

## 1. Project Vision

ForgeAI is a production-oriented AI coding platform inspired by modern AI software-development agents such as Codex and Claude Code.

A user should be able to describe an application in natural language:

> Build me a React food-delivery application with authentication, restaurant listings, cart, checkout, and an admin dashboard.

ForgeAI will:

1. Require the user to sign up or log in.
2. Create and persist a user account.
3. Create a project owned by that user.
4. Understand the user's request.
5. Create an implementation plan.
6. Select an appropriate legitimate free AI model.
7. Generate and modify source code.
8. Execute controlled tools.
9. Build and test the generated application in an isolated sandbox.
10. Detect and repair errors.
11. Maintain the project's persistent workspace.
12. Maintain project versions and history.
13. Create a downloadable ZIP artifact.
14. Allow the user to return later and request additional improvements.
15. Generate a new project version and downloadable ZIP after improvements.
16. Allow users to upload an existing ZIP and continue development.

The application will be designed from the beginning as a production-style, secure, multi-user application.

---

# 2. Core Product Experience

The primary user journey is:

```text
Landing Page
      |
      +-------------------+
      |                   |
    Sign Up              Login
      |                   |
      +---------+---------+
                |
                v
           Dashboard
                |
        +-------+-------+
        |               |
   New Project      My Projects
        |               |
        v               v
   User Prompt       Existing Project
        |               |
        +-------+-------+
                |
                v
             AI Agent
                |
                v
       Plan → Code → Build
                |
                v
        Test → Fix → Verify
                |
                v
           New Version
                |
                v
            ZIP Export
                |
                v
             Download
```

If the user later says:

```text
Add dark mode and improve checkout.
```

ForgeAI continues from the existing project:

```text
Existing Workspace
        |
        v
      Agent
        |
        v
   Modify Code
        |
        v
    Build/Test
        |
        v
   New Version
        |
        v
   New ZIP
```

The application is not regenerated from scratch.

---

# 3. Authentication Comes First

ForgeAI is a multi-user application.

Users must **sign up or log in before their projects and data can be saved**.

Authentication is therefore a foundational feature, not a later addition.

## User lifecycle

```text
New User
   |
   v
Sign Up
   |
   v
Account Created
   |
   v
Login / Session
   |
   v
Dashboard
```

Returning user:

```text
User
 |
 v
Login
 |
 v
Authenticated Session
 |
 v
Dashboard
 |
 v
Existing Projects
```

---

# 4. User-Owned Data

Every important resource must belong to an authenticated user.

Conceptually:

```text
User
 |
 +-- Projects
 |     |
 |     +-- Versions
 |     |
 |     +-- Agent Runs
 |     |
 |     +-- Tasks
 |     |
 |     +-- Artifacts
 |     |
 |     +-- Workspace
 |
 +-- Sessions
 |
 +-- Model Credentials
 |
 +-- Usage Records
 |
 +-- Settings
```

Example:

```text
User A
 ├── Food Delivery App
 ├── E-commerce App
 └── Portfolio

User B
 ├── CRM Application
 └── Blog Platform
```

User B must never be able to access User A's projects.

---

# 5. Authentication Architecture

For the browser application, ForgeAI will initially use secure server-side sessions.

Conceptually:

```text
Browser
   |
   | Login credentials
   v
POST /api/v1/auth/login
   |
   v
API
   |
   +-- Find user
   +-- Verify password
   +-- Create session
   |
   v
Secure HttpOnly Cookie
   |
   v
Browser
```

Future authenticated requests:

```text
Browser
   |
   | Secure HttpOnly Cookie
   v
API
   |
   v
Authentication Middleware
   |
   v
Identify User
   |
   v
Authorization
   |
   v
Controller / Service
```

Redis may be used as the session store when the infrastructure is established.

---

# 6. Password Security

Passwords must never be stored as plaintext.

Never:

```text
password = "mypassword123"
```

Instead:

```text
Password
   |
   v
Argon2id
   |
   v
Password Hash
   |
   v
PostgreSQL
```

Passwords and password hashes must never be returned to the frontend.

The implementation should also consider:

- Password strength requirements
- Login rate limiting
- Account enumeration protection
- Secure password reset
- Session expiration
- Session revocation
- Email verification where feasible
- Audit logging

---

# 7. Authentication Security

Security requirements include:

- HttpOnly cookies
- Secure cookies in production
- SameSite configuration
- CSRF protection where applicable
- Login rate limiting
- Password hashing with a modern password-hashing algorithm
- Session expiration
- Session invalidation
- Authorization checks
- Secure password reset
- No credential logging
- No secrets in ZIP exports
- No sensitive data in client-side storage unless explicitly required

Long-lived authentication tokens should not be placed into `localStorage` for the browser application.

---

# 8. Authorization

Authentication answers:

> Who is the user?

Authorization answers:

> Is this user allowed to access this resource?

Every project operation must verify ownership or explicit permission.

Example:

```text
User A
  |
  +-- Project 123
```

If User B requests:

```text
GET /api/v1/projects/123
```

the backend must not expose Project 123.

Every protected operation should follow:

```text
Request
   |
   v
Authentication
   |
   v
Identify User
   |
   v
Authorization
   |
   v
Resource Access
```

Never trust a project ID supplied by the client without checking ownership.

---

# 9. Zero-Budget Requirement

The project must be designed for a $0 development and initial deployment budget.

We will:

- Prefer open-source software.
- Prefer local development.
- Prefer free hosting tiers.
- Prefer free database tiers.
- Prefer free Redis-compatible services.
- Use legitimate free AI quotas.
- Support local AI models.
- Avoid paid services wherever possible.
- Never automatically trigger paid AI usage.
- Keep external services replaceable.

### Important limitation

Free services have limits.

They may restrict:

- requests
- tokens
- CPU
- memory
- storage
- bandwidth
- execution time
- concurrent users
- model availability

ForgeAI must handle these limitations gracefully.

---

# 10. Multi-Model Free AI Strategy

ForgeAI will not depend on a single AI provider.

It will use a provider/model gateway and router.

Conceptually:

```text
                         Model Router
                              |
          +-------------------+-------------------+
          |                   |                   |
       Provider A          Provider B          Provider C
          |                   |                   |
      Free quota           Free quota          Free quota
          |                   |                   |
          +-------------------+-------------------+
                              |
                              v
                            Agent
```

Potential providers/models may include, subject to current availability, terms, quotas, API access, and technical suitability:

- Google Gemini
- Groq
- Cerebras
- OpenRouter free models
- Mistral
- SambaNova
- Cloudflare Workers AI
- GitHub Models
- Hugging Face
- NVIDIA-hosted/free-access model options
- Z.AI
- Cohere
- Other legitimate free providers
- Local models through Ollama

Provider availability must be verified before production integration.

We will never attempt to bypass quotas, create fake accounts, or violate provider terms.

---

# 11. Model Failover

If one legitimate free model/provider becomes unavailable or its quota is exhausted:

```text
Selected Model
      |
      v
Quota / Request Failure
      |
      v
Model Router
      |
      v
Select Another Suitable Model
      |
      v
Continue Same Agent Task
```

Example:

```text
Gemini
  |
  +-- unavailable
        |
        v
Cerebras
  |
  +-- unavailable
        |
        v
Groq
  |
  +-- unavailable
        |
        v
OpenRouter free model
  |
  +-- unavailable
        |
        v
Local Ollama model
```

The agent's state must survive provider changes.

---

# 12. No Automatic Paid Usage

This is a mandatory requirement.

If all free providers are unavailable:

```text
Free capacity exhausted
        |
        +--> Local model available?
        |       |
        |       +--> YES → Continue
        |
        +--> NO
                |
                v
           Pause / Queue
                |
                v
        Inform the user honestly
```

ForgeAI must never silently convert a failed free request into a paid request.

---

# 13. Bring Your Own Key

Where provider terms permit it, users may eventually add their own legitimate API keys.

Potential model capacity:

```text
ForgeAI Free Capacity
+
User's Legitimate API Keys
+
Local Models
```

API keys must:

- Never be exposed to the browser unnecessarily.
- Never be logged.
- Never be included in generated ZIP files.
- Be encrypted at rest.
- Be accessible only by authorized server-side components.

---

# 14. High-Level Architecture

```text
                         USERS
                           |
                           v
                    +-------------+
                    |  Frontend   |
                    | React/Vite  |
                    +------+------+
                           |
                           v
                    +-------------+
                    | CDN / WAF   |
                    +------+------+
                           |
                           v
                    +-------------+
                    | API Layer   |
                    | Node/Express|
                    +------+------+
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
    PostgreSQL           Redis        Object Storage
          |                |
          |                v
          |             Job Queue
          |                |
          |                v
          |          Agent Workers
          |                |
          |                v
          |          Model Gateway
          |                |
          |       +--------+--------+
          |       |        |        |
          |       v        v        v
          |    Provider  Provider  Local
          |       A        B       Model
          |
          v
     Project Metadata

Agent Worker
     |
     v
Secure Sandbox
     |
     +-- Files
     +-- Terminal
     +-- Build
     +-- Tests
     +-- Browser verification
```

---

# 15. Technology Stack

## Frontend

- React
- Vite
- JavaScript
- ES Modules
- Monaco Editor
- WebSockets or streaming transport

## Backend

- Node.js
- Express
- JavaScript
- ES Modules

## Database

- PostgreSQL
- Prisma

## Cache / Queue / Sessions

- Redis

## AI

- Provider abstraction
- Multiple free model providers
- Ollama/local models

## Sandbox

- Docker

## Browser Automation

- Playwright

## Testing

- Vitest
- Supertest

## Code Quality

- ESLint
- Prettier

---

# 16. Database Architecture

The initial conceptual model:

```text
User
 |
 +-- Sessions
 |
 +-- Projects
 |     |
 |     +-- Project Versions
 |     |
 |     +-- Agent Runs
 |     |
 |     +-- Tasks
 |     |
 |     +-- Project Files / Workspace Metadata
 |     |
 |     +-- Artifacts
 |
 +-- Model Credentials
 |
 +-- Usage Records
 |
 +-- Settings
 |
 +-- Audit Logs
```

Potential database entities:

```text
User
Session
Project
ProjectVersion
ProjectFile
AgentRun
AgentTask
AgentMessage
ToolCall
Artifact
ModelProvider
Model
ModelCredential
UsageRecord
AuditLog
```

The exact Prisma schema will be designed during implementation.

---

# 17. Project Workspace

The project workspace is the live source of truth.

Example:

```text
Project
 |
 +-- package.json
 +-- src/
 +-- public/
 +-- README.md
 +-- ...
```

The ZIP file is an export artifact, not the source of truth.

This allows:

- Continuous development
- Version history
- Rollback
- Repeated improvements
- ZIP export
- ZIP import

---

# 18. Project Versioning

Every successful task can produce a new project version.

Example:

```text
Version 1
Initial application

Version 2
Added authentication

Version 3
Added dark mode

Version 4
Improved checkout
```

Git will be used internally where appropriate.

Flow:

```text
Agent modifies files
        |
        v
Build
        |
        v
Test
        |
        v
Success
        |
        v
Git Commit
        |
        v
Project Version
        |
        v
ZIP Artifact
```

---

# 19. ZIP Export

Users must be able to download their generated applications.

Example:

```text
food-delivery-app-v4.zip
```

Export flow:

```text
Project Workspace
       |
       v
Export Validation
       |
       v
Remove internal secrets/configuration
       |
       v
Create ZIP
       |
       v
Private Artifact Storage
       |
       v
Secure Download
```

The ZIP must never contain:

- ForgeAI API keys
- AI provider credentials
- Database passwords
- Redis credentials
- Authentication tokens
- Internal server secrets
- Private infrastructure configuration
- Sensitive environment variables

---

# 20. ZIP Import

Users should also be able to upload an existing project.

Flow:

```text
User ZIP
   |
   v
Authentication
   |
   v
Upload Validation
   |
   v
Archive Security Checks
   |
   v
Isolated Extraction
   |
   v
Project Analysis
   |
   v
Agent
   |
   v
Build/Test
   |
   v
New Project Version
   |
   v
New ZIP
```

ZIP security checks must include:

- Maximum archive size
- Maximum file count
- Path traversal detection
- Maximum uncompressed size
- Safe extraction
- File-type restrictions where appropriate
- Resource limits

---

# 21. Agent Architecture

The AI agent is the central intelligence layer.

Basic loop:

```text
User Request
     |
     v
Task Understanding
     |
     v
Planning
     |
     v
Context Selection
     |
     v
Model Router
     |
     v
LLM
     |
     v
Tool Call
     |
     v
Tool Execution
     |
     v
Observation
     |
     +--------> LLM
     |
     v
Build / Test
     |
     +---- failure ----> Agent Repair Loop
     |
     v
Success
     |
     v
Version + ZIP
```

The agent must maintain persistent task state.

---

# 22. Tool System

The LLM must never receive unrestricted access to the server.

Potential tools:

```text
list_files
read_file
write_file
edit_file
delete_file
search_files
create_directory
execute_command
install_dependency
run_build
run_tests
git_status
git_diff
git_commit
browser_open
browser_screenshot
```

Tool arguments must be structured and validated.

Example:

```json
{
  "tool": "read_file",
  "arguments": {
    "path": "src/App.jsx"
  }
}
```

The server validates the request before execution.

---

# 23. Secure Sandbox

Generated code is untrusted.

It must never execute directly on the API host.

Initial sandbox technology:

```text
Docker
```

Sandbox controls should include:

- CPU limits
- Memory limits
- Process limits
- Disk limits
- Execution timeouts
- Filesystem isolation
- Restricted privileges
- Restricted network access
- Disposable environments

Conceptually:

```text
Project
   |
   v
Sandbox
   |
   +-- npm install
   +-- npm build
   +-- npm test
   +-- development server
   |
   v
Results
   |
   v
Destroy Sandbox
```

Docker is an isolation mechanism, not a complete security guarantee. The sandbox must be hardened separately.

---

# 24. Security Model

Security is a first-class requirement.

## Authentication

- Secure password hashing
- Server-side sessions
- Secure cookies
- Session expiration
- Session revocation
- Login rate limiting
- Password reset
- Email verification where feasible

## Authorization

Every project operation verifies:

```text
Authenticated User
        +
Resource Ownership / Permission
```

## Input Validation

Validate:

- Request bodies
- Query parameters
- Path parameters
- File paths
- Uploaded ZIPs
- Tool arguments
- Model outputs

## Rate Limiting

Multiple levels:

```text
IP
User
Project
Endpoint
Agent Run
Model Provider
```

## Secret Protection

Never expose or log:

- Passwords
- Password hashes
- API keys
- Database credentials
- Redis credentials
- Session secrets
- Internal tokens

## Path Traversal Protection

Reject unsafe paths such as:

```text
../../../../etc/passwd
```

All file operations must remain inside the authorized project workspace.

## ZIP Security

Uploaded ZIPs must be checked for:

- Path traversal
- Decompression bombs
- Excessive file count
- Excessive uncompressed size
- Unsafe extraction
- Resource consumption

## Prompt Injection

Treat all of the following as untrusted:

- User prompts
- Existing project files
- README files
- Code comments
- Terminal output
- Web pages
- Dependency output
- Generated code

The agent must not blindly follow instructions contained inside untrusted project content.

---

# 25. Model Gateway

All AI providers should be accessed through a common internal interface.

The rest of ForgeAI should not contain provider-specific implementation everywhere.

Conceptually:

```js
const response = await modelGateway.generate({
    taskType: "coding",
    messages,
    tools,
    requirements
});
```

The gateway handles:

- Provider selection
- Model selection
- Credentials
- Retries
- Timeouts
- Rate limits
- Quota tracking
- Health checks
- Failover
- Usage accounting
- Provider normalization

---

# 26. Quota-Aware Routing

The router should consider:

```text
Model capability
Remaining quota
Requests per minute
Tokens per minute
Provider health
Latency
Failure rate
Task type
Context window
Tool support
```

Example:

```text
Task: Complex React debugging

Gemini       94
Cerebras     90
Groq         87
OpenRouter   82
Mistral      79
Local model  65
```

The router chooses the highest suitable available model.

---

# 27. Context Optimization

Free quotas are limited, so unnecessary token usage must be minimized.

Instead of sending an entire project to every model request:

```text
500 files
```

ForgeAI should select relevant context:

```text
User request
+
Project summary
+
Relevant files
+
Recent changes
+
Current errors
+
Task state
```

Potential optimizations:

- File relevance search
- Project summaries
- Code summaries
- Caching
- Incremental context
- Tool-result reuse
- Task-specific context

---

# 28. Observability

Important operations should be traceable.

Example:

```text
Agent Run #8231

16:21:01 Model selected: Gemini
16:21:03 read_file package.json
16:21:05 write_file src/App.jsx
16:21:08 npm run build
16:21:23 BUILD FAILED
16:21:31 Switched model: Groq
16:21:40 write_file src/App.jsx
16:21:43 npm run build
16:21:51 BUILD PASSED
16:21:52 Version created
16:21:53 ZIP created
```

Logs must never contain secrets.

Important identifiers:

- Request ID
- User ID
- Project ID
- Agent Run ID
- Task ID
- Model/provider
- Latency
- Token usage
- Tool calls
- Errors

---

# 29. Frontend Experience

The eventual application should contain:

```text
+--------------------------------------------------------------+
| ForgeAI                                   New Project         |
+----------------+-------------------------+---------------------+
| Files          | Code Editor             | Agent               |
|                |                         |                     |
| src/           | App.jsx                | User:               |
|  components/   |                         | Build a food        |
|  pages/        | function App() {}       | delivery app        |
| package.json   |                         |                     |
|                |                         | Agent:              |
|                |                         | Planning...         |
+----------------+-------------------------+---------------------+
| Terminal / Build Logs                 | Live Preview         |
+---------------------------------------+----------------------+
```

Features:

- Authentication
- User dashboard
- AI chat
- Project creation
- Project list
- File explorer
- Code editor
- Terminal
- Build logs
- Live preview
- Agent progress
- Version history
- ZIP download
- ZIP upload
- Project settings
- Usage information

---

# 30. User Dashboard

After login, users should see their own data.

Example:

```text
ForgeAI Dashboard

Welcome back!

[ + New Project ]

My Projects

┌────────────────────────────────────────────┐
│ Food Delivery App                          │
│ Last updated: Today                        │
│ Version: 4                                 │
│                                            │
│ [Open] [Download]                          │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ Portfolio Website                          │
│ Last updated: Yesterday                    │
│ Version: 2                                 │
│                                            │
│ [Open] [Download]                          │
└────────────────────────────────────────────┘
```

Users must only see projects they own or are explicitly authorized to access.

---

# 31. Project Continuity

A project should persist across sessions.

Example:

```text
Monday
User creates project
       |
       v
Version 1
       |
       v
Downloads ZIP

Wednesday
User logs in
       |
       v
Opens same project
       |
       v
"Add dark mode"
       |
       v
Version 2
       |
       v
Downloads new ZIP
```

The user should not have to explain the project from scratch every time.

---

# 32. Long-Term Vision

Eventually, a user should be able to say:

```text
Build me a SaaS application.
```

ForgeAI should:

```text
Understand requirements
       ↓
Plan architecture
       ↓
Create project
       ↓
Write code
       ↓
Install dependencies
       ↓
Run application
       ↓
Test application
       ↓
Open browser
       ↓
Inspect UI
       ↓
Detect problems
       ↓
Fix problems
       ↓
Repeat
       ↓
Create project version
       ↓
Export ZIP
```

Then:

```text
Add Google authentication.
```

or:

```text
Make the dashboard responsive.
```

or:

```text
Add an admin panel.
```

and ForgeAI continues working on the existing project.

---

# 33. Development Roadmap

## Phase 0 — Architecture

- Product requirements
- Threat model
- Architecture
- Technology decisions
- Repository design

## Phase 1 — Project Foundation

- Node.js
- JavaScript
- ES Modules
- npm workspaces
- Git
- ESLint
- Prettier
- Environment configuration
- Structured logging
- Error handling
- API versioning
- Security middleware
- Testing

## Phase 2 — Authentication and Users

- PostgreSQL
- Prisma
- User model
- Registration
- Login
- Password hashing
- Secure sessions
- Cookies
- Logout
- Session expiration
- Authorization middleware
- User/project ownership
- Login rate limiting
- Password reset
- Email verification where feasible

## Phase 3 — Redis

- Redis connection
- Session storage
- Caching
- Rate limiting
- Job queues
- Worker architecture

## Phase 4 — Project System

- Create project
- Workspace
- File operations
- Project metadata
- Project versions
- Git integration
- User ownership

## Phase 5 — ZIP System

- ZIP export
- Artifact storage
- Secure downloads
- ZIP import
- Archive security
- Export secret filtering

## Phase 6 — Model Gateway

- Provider abstraction
- Model registry
- Provider adapters
- Quota tracking
- Health checks
- Retries
- Failover
- Local models

## Phase 7 — Agent Engine

- System instructions
- Task state
- Planning
- Context selection
- Tool calling
- Agent loop
- Error recovery

## Phase 8 — Sandbox

- Docker
- Filesystem isolation
- Command execution
- Resource limits
- Timeouts
- Network policy
- Build/test execution

## Phase 9 — Coding Agent

- File tools
- Terminal tools
- Package installation
- Build
- Test
- Repair loop
- Git commits

## Phase 10 — AI IDE

- React interface
- Monaco
- Streaming
- WebSockets
- File explorer
- Terminal
- Preview
- Agent progress

## Phase 11 — Browser Verification

- Playwright
- Screenshots
- Browser interaction
- UI testing
- Visual verification

## Phase 12 — Production Deployment

- Free hosting
- Database
- Redis
- Object storage
- Environment configuration
- CI/CD
- Backups
- Monitoring
- Security hardening

## Phase 13 — Optimization

- Token reduction
- Caching
- Model routing improvements
- Queue optimization
- Worker scaling
- Performance improvements

---

# 34. Initial Repository Structure

The repository will evolve toward:

```text
forge-ai/
│
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   │   ├── agent/
│   │   │   │   ├── artifact/
│   │   │   │   ├── auth/
│   │   │   │   ├── project/
│   │   │   │   ├── sandbox/
│   │   │   │   └── verification/
│   │   │   ├── providers/
│   │   │   ├── tools/
│   │   │   ├── workers/
│   │   │   └── app.js
│   │   └── package.json
│   │
│   └── web/
│       ├── src/
│       └── package.json
│
├── packages/
│   ├── shared/
│   ├── validation/
│   └── model-sdk/
│
├── infrastructure/
│   ├── docker/
│   └── deployment/
│
├── prisma/
│   └── schema.prisma
│
├── tests/
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
└── README.md
```

The structure can change as implementation requirements become clearer.

---

# 35. Development Philosophy

This is both a production project and a learning project.

The implementation should follow:

```text
WHAT
 ↓
WHY
 ↓
HOW
 ↓
IMPLEMENT
 ↓
TEST
 ↓
SECURE
 ↓
IMPROVE
```

The developer is comfortable with JavaScript, so JavaScript and ES Modules will be used instead of TypeScript.

We will still introduce production-level concepts progressively.

---

# 36. Initial Environment

Local development should work without paid services.

Possible local components:

```text
Node.js
PostgreSQL
Redis
Docker
Ollama
```

External free AI providers can be configured through environment variables.

Example:

```env
NODE_ENV=development
PORT=4000

DATABASE_URL=
REDIS_URL=

SESSION_SECRET=

GEMINI_API_KEY=
GROQ_API_KEY=
CEREBRAS_API_KEY=
OPENROUTER_API_KEY=

OLLAMA_BASE_URL=
```

Only `.env.example` should be committed to Git.

Real secrets must never be committed.

---

# 37. Production Security Principles

ForgeAI follows defense-in-depth.

1. Never trust user input.
2. Never trust AI output.
3. Never execute generated code on the API host.
4. Never expose server secrets to generated applications.
5. Never trust project IDs without authorization checks.
6. Never allow unrestricted filesystem access.
7. Never allow unrestricted command execution.
8. Never automatically use paid AI capacity.
9. Never log credentials.
10. Never assume Docker alone provides complete isolation.
11. Validate every tool call.
12. Limit resource consumption.
13. Keep audit trails.
14. Prefer disposable execution environments.
15. Design for graceful failure.
16. Make user data tenant-isolated.
17. Verify authorization on every protected resource.
18. Protect authentication sessions.
19. Keep downloadable artifacts private.
20. Remove secrets from exported projects.

---

# 38. Non-Goals

Initially, we will NOT attempt to:

- Train our own LLM.
- Build an LLM from scratch.
- Bypass model-provider quotas.
- Create fake accounts to multiply quotas.
- Guarantee unlimited free inference.
- Provide unrestricted server-side code execution.
- Immediately support every programming language.
- Immediately support every cloud provider.
- Build unnecessary distributed infrastructure before it is needed.
- Automatically use paid APIs without explicit user consent.

---

# 39. First Milestone

The first milestone is intentionally small:

```text
ForgeAI repository
        ↓
Production-style Node/Express API
        ↓
ES Modules
        ↓
Environment configuration
        ↓
Logging
        ↓
Error handling
        ↓
Security foundation
        ↓
PostgreSQL
        ↓
User registration
        ↓
Login
        ↓
Secure sessions
        ↓
Authorization
        ↓
Tests
```

Only after the authentication and data foundation is stable should we move deeper into the agent system.

---

# 40. Success Criteria

ForgeAI will eventually be considered successful when a normal user can:

1. Open ForgeAI.
2. Sign up.
3. Log in.
4. Maintain a secure authenticated session.
5. Create a project.
6. Enter a natural-language application request.
7. Start an agent run.
8. Watch the agent work.
9. See generated files.
10. See build/test results.
11. See the application preview.
12. Download a ZIP.
13. Log out.
14. Log in later.
15. See their previous projects.
16. Reopen the same project.
17. Request improvements.
18. Receive a new version.
19. Download the new ZIP.
20. View project history.
21. Roll back where supported.
22. Upload an existing ZIP.
23. Continue development from the uploaded application.
24. Continue agent work when one legitimate free model provider becomes unavailable, provided another legitimate free capacity source exists.

---

# 41. Guiding Principle

The central architectural principle of ForgeAI is:

> **The user asks for software. Authentication establishes ownership. The project workspace preserves the user's application. The agent plans and changes the project. The model router keeps the agent running across legitimate free model capacity. The sandbox proves the generated code can run safely. Versions preserve history. ZIP artifacts give the user ownership of the final application.**

---

# 42. Current Project Status

```text
Project:             ForgeAI
Stage:               Architecture / Planning
Budget:              $0 target
Language:            JavaScript
Module System:       ES Modules
Backend:             Node.js + Express
Frontend:            React + Vite
Database:             PostgreSQL + Prisma
Cache/Queue:          Redis
Sessions:             Server-side sessions
Sandbox:              Docker
Browser Testing:      Playwright
Local AI:             Ollama-compatible
AI Strategy:          Multi-provider free-model routing
Export:               ZIP artifacts
Import:               ZIP projects
Versioning:           Git + project versions
Authentication:       Required
Authorization:        Required
Security:             Production-first
Architecture:         Multi-user
```

---

# 43. Next Implementation Step

We should begin from the repository foundation rather than jumping directly into AI.

Implementation order:

```text
1. Create repository
2. Configure npm workspaces
3. Configure ES Modules
4. Create API application
5. Create frontend application
6. Configure environment handling
7. Add structured logging
8. Add error handling
9. Add security middleware
10. Add PostgreSQL
11. Create User model
12. Implement secure registration
13. Implement secure login
14. Implement sessions
15. Implement logout
16. Implement authentication middleware
17. Implement authorization
18. Test authentication
19. Create project model
20. Enforce user-owned projects
21. Continue toward Redis, agent, sandbox, models, and ZIP artifacts
```

The project should be built incrementally and tested after every major milestone.

---

## Final Product Vision

```text
                           FORGEAI
                              |
                         Authentication
                              |
                         User Dashboard
                              |
                    +---------+---------+
                    |                   |
               New Project         Existing Project
                    |                   |
                 Prompt               ZIP Upload
                    |                   |
                    +---------+---------+
                              |
                         Project Workspace
                              |
                           AI Agent
                              |
                    +---------+---------+
                    |                   |
               Model Router          Tools
                    |                   |
                    +---------+---------+
                              |
                           Sandbox
                              |
                    +---------+---------+
                    |                   |
                  Build                Test
                    |                   |
                    +---------+---------+
                              |
                         Repair Loop
                              |
                           Success
                              |
                       Git Version
                              |
                         ZIP Artifact
                              |
                           Download
                              |
                     User requests change
                              |
                              v
                         New Version
                              |
                          New ZIP
```

**ForgeAI is intended to become a secure, multi-user, zero-budget-target AI software-development platform where users can create applications from prompts, continue improving them over time, maintain version history, and always retain a downloadable copy of their work.**
