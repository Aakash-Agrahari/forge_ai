import AdmZip from "adm-zip";
import path from "node:path";
import {
    createProjectFile,
    upsertProjectFile
} from "./fileService.js";
import {
    createProjectFolder
} from "./folderService.js";

const MAX_ARCHIVE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024; // 200 MB
const MAX_FILES = 5000;
const MAX_FILE_CONTENT = 1_000_000;

const IGNORED_DIRECTORIES = new Set([
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage",
    ".cache"
]);

const TEXT_EXTENSIONS = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".py",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".go",
    ".rs",
    ".php",
    ".rb",
    ".kt",
    ".kts",
    ".swift",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".md",
    ".txt",
    ".sql",
    ".sh",
    ".bat",
    ".ps1",
    ".env",
    ".properties",
    ".toml",
    ".ini",
    ".gitignore"
]);

function normalizeArchivePath(entryName) {
    return entryName
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+/g, "/");
}

function isUnsafePath(filePath) {
    const normalized = normalizeArchivePath(filePath);

    if (!normalized) {
        return true;
    }

    const parts = normalized.split("/");

    if (parts.includes("..")) {
        return true;
    }

    if (parts.some((part) => part.includes("\0"))) {
        return true;
    }

    return false;
}

function shouldIgnorePath(filePath) {
    const parts = normalizeArchivePath(filePath).split("/");

    return parts.some((part) =>
        IGNORED_DIRECTORIES.has(part)
    );
}

function isTextFile(filePath) {
    const fileName = path.posix.basename(filePath);
    const extension = path.posix.extname(fileName).toLowerCase();

    if (TEXT_EXTENSIONS.has(extension)) {
        return true;
    }

    // Files such as .gitignore, .env, Dockerfile, Makefile
    // do not always have an extension.
    if (
        fileName === ".gitignore" ||
        fileName === ".dockerignore" ||
        fileName === "Dockerfile" ||
        fileName === "Makefile" ||
        fileName === "Procfile"
    ) {
        return true;
    }

    return false;
}

function getParentDirectories(filePath) {
    const normalized = normalizeArchivePath(filePath);
    const parts = normalized.split("/");

    parts.pop();

    const directories = [];

    for (let i = 1; i <= parts.length; i++) {
        directories.push(parts.slice(0, i).join("/"));
    }

    return directories;
}

function validateArchive(zip) {
    const entries = zip.getEntries();

    if (entries.length > MAX_FILES) {
        throw new Error(
            `Archive contains too many entries. Maximum allowed is ${MAX_FILES}.`
        );
    }

    let totalUncompressedSize = 0;

    for (const entry of entries) {
        const entryPath = normalizeArchivePath(entry.entryName);

        if (isUnsafePath(entryPath)) {
            throw new Error(
                `Unsafe archive path detected: ${entry.entryName}`
            );
        }

        if (shouldIgnorePath(entryPath)) {
            continue;
        }

        const size = Number(entry.header?.size || 0);

        totalUncompressedSize += size;

        if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
            throw new Error(
                "Archive exceeds the maximum uncompressed size of 200 MB."
            );
        }
    }

    return entries;
}

export async function importProjectArchive({
    projectId,
    buffer
}) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error("Invalid archive data.");
    }

    if (buffer.length > MAX_ARCHIVE_SIZE) {
        throw new Error(
            "Archive is too large. Maximum allowed size is 50 MB."
        );
    }

    let zip;

    try {
        zip = new AdmZip(buffer);
    } catch (error) {
        throw new Error("Invalid or corrupted ZIP archive.");
    }

    const entries = validateArchive(zip);

    const folders = new Set();
    const importedFiles = [];
    const skippedFiles = [];

    for (const entry of entries) {
        const entryPath = normalizeArchivePath(entry.entryName);

        if (!entryPath) {
            continue;
        }

        if (shouldIgnorePath(entryPath)) {
            skippedFiles.push(entryPath);
            continue;
        }

        if (entry.isDirectory) {
            folders.add(entryPath.replace(/\/$/, ""));
            continue;
        }

        if (!isTextFile(entryPath)) {
            skippedFiles.push(entryPath);
            continue;
        }

        const data = entry.getData();

        if (data.length > MAX_FILE_CONTENT) {
            skippedFiles.push(entryPath);
            continue;
        }

        const content = data.toString("utf8");

        for (const folder of getParentDirectories(entryPath)) {
            folders.add(folder);
        }

        await upsertProjectFile({
            projectId,
            path: entryPath,
            content
        });

        importedFiles.push(entryPath);
    }

    const sortedFolders = [...folders].sort(
        (a, b) => a.split("/").length - b.split("/").length
    );

    for (const folderPath of sortedFolders) {
        try {
            await createProjectFolder({
                projectId,
                path: folderPath
            });
        } catch (error) {
            // Folder may already exist.
            // File import should continue.
        }
    }

    return {
        importedFiles,
        skippedFiles,
        importedFileCount: importedFiles.length,
        skippedFileCount: skippedFiles.length,
        importedFolderCount: sortedFolders.length
    };
}

export async function exportProjectArchive({
    project
}) {
    if (!project) {
        throw new Error("Project is required.");
    }

    const zip = new AdmZip();

    const files = project.files || [];

    for (const file of files) {
        const filePath = normalizeArchivePath(file.path);

        if (!filePath || isUnsafePath(filePath)) {
            continue;
        }

        if (shouldIgnorePath(filePath)) {
            continue;
        }

        if (!isTextFile(filePath)) {
            continue;
        }

        const content = typeof file.content === "string"
            ? file.content
            : "";

        if (Buffer.byteLength(content, "utf8") > MAX_FILE_CONTENT) {
            continue;
        }

        zip.addFile(
            filePath,
            Buffer.from(content, "utf8")
        );
    }

    return zip.toBuffer();
}