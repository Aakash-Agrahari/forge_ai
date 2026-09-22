import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getProjectFiles } from "../services/fileService.js";
import { runSandboxCommand } from "./sandboxRunner.js";

function createWorkspacePath() {
    return path.join(
        os.tmpdir(),
        `forgeai-sandbox-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`
    );
}

async function createWorkspace(workspacePath) {
    await fs.mkdir(workspacePath, {
        recursive: true
    });
}

async function writeProjectFiles({
    workspacePath,
    files
}) {
    for (const file of files) {
        const relativePath = file.path;

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

export async function executeProjectCommand({
    projectId,
    command,
    timeoutMs = 30_000,
    maxOutputBytes = 1_000_000
}) {
    if (!projectId) {
        const error = new Error(
            "Project ID is required"
        );

        error.code = "PROJECT_ID_REQUIRED";

        throw error;
    }

    const files = await getProjectFiles(projectId);

    const workspacePath = createWorkspacePath();

    try {
        await createWorkspace(workspacePath);

        await writeProjectFiles({
            workspacePath,
            files
        });

        return await runSandboxCommand({
            command,
            cwd: workspacePath,
            timeoutMs,
            maxOutputBytes
        });
    } finally {
        await removeWorkspace(workspacePath);
    }
}