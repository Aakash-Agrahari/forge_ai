import { validateProjectPath } from "./projectPath.js";

const validPaths = [
    "src/App.jsx",
    "src/components/Header.jsx",
    "README.md",
    "package.json"
];

const invalidPaths = [
    "../secret.txt",
    "../../.env",
    "../../../something",
    "/etc/passwd",
    "C:/Users/aakas/.env",
    "C:\\Users\\aakas\\.env"
];

for (const path of validPaths) {
    console.log(
        "VALID:",
        path,
        "→",
        validateProjectPath(path)
    );
}

for (const path of invalidPaths) {
    try {
        validateProjectPath(path);

        console.error(
            "FAILED: path should have been rejected:",
            path
        );
    } catch (error) {
        console.log(
            "REJECTED:",
            path,
            "→",
            error.code
        );
    }
}