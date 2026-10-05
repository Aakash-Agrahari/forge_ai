import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getProjectFiles } from "../services/fileService.js";
import { validateProjectPath } from "../agent/projectPath.js";
import { runSandboxCommand } from "./sandboxRunner.js";
import { getSandboxConfig } from "./sandboxConfig.js";

function createWorkspacePath() {
    return path.join(
        os.tmpdir(),
        `forgeai-sandbox-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`
    );
}

async function createWorkspace(workspacePath) {
    await fs.mkdir(workspacePath, { recursive: true });
}

async function writeProjectFiles({ workspacePath, files }) {
    for (const file of files) {
        const relativePath = validateProjectPath(file.path);

        const targetPath = path.join(
            workspacePath,
            ...relativePath.split("/")
        );

        const parentDirectory = path.dirname(targetPath);

        await fs.mkdir(parentDirectory, {
            recursive: true
        });

        await fs.writeFile(
            targetPath,
            file.content,
            "utf8"
        );
    }
}

async function removeWorkspace(workspacePath) {
    await fs.rm(workspacePath, {
        recursive: true,
        force: true
    });
}

export async function createSandboxSession({
    projectId
}) {
    if (!projectId) {
        const error = new Error(
            "Project ID is required to create a sandbox session"
        );

        error.code = "PROJECT_ID_REQUIRED";

        throw error;
    }

    const files = await getProjectFiles(projectId);

    const workspacePath = createWorkspacePath();

    const sandboxConfig = getSandboxConfig();

    await createWorkspace(workspacePath);

    try {
        await writeProjectFiles({
            workspacePath,
            files
        });
    } catch (error) {
        await removeWorkspace(workspacePath);
        throw error;
    }

    let closed = false;

    return {
        workspacePath,

        async run({
            command,
            timeoutMs = 30_000,
            maxOutputBytes = 1_000_000
        }) {
            if (closed) {
                const error = new Error(
                    "Sandbox session has already been closed"
                );

                error.code = "SANDBOX_SESSION_CLOSED";

                throw error;
            }

            return runSandboxCommand({
                command,
                cwd: workspacePath,
                timeoutMs,
                maxOutputBytes,
                backend: sandboxConfig.backend
            });
        },

        async close() {
            if (closed) {
                return;
            }

            closed = true;

            await removeWorkspace(workspacePath);
        }
    };
}