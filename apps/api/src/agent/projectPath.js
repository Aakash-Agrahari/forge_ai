function normalizeProjectPath(inputPath){
    if(typeof inputPath !== "string"){
        const error = new Error("Project path must be a string");
        error.code = "INVALID_PROJECT_PATH";
        throw error;
    }

    const trimmedPath = inputPath.trim();

    if(!trimmedPath){
        const error = new Error("Project path cannot be empty");
        error.code = "EMPTY_PROJECT_PATH";
        throw error;
    }

    //always use forward slashes internally
    const normalized = trimmedPath.replaceAll("\\", "/");

    if(normalized.startsWith("/")){
        const error = new Error("Absolute paths are not allowed");
        error.code = "ABSOLUTE_PATH_NOT_ALLOWED";
        throw error;
    }

    // Reject Windows drive paths such as C:/...
    if (/^[a-zA-Z]:\//.test(normalized)) {
        const error = new Error("Absolute paths are not allowed");
        error.code = "ABSOLUTE_PATH_NOT_ALLOWED";
        throw error;
    }

    const segments = normalized.split("/");

    // Reject traversal.
    if (segments.some((segment) => segment === "..")) {
        const error = new Error(
            "Path traversal is not allowed"
        );
        error.code = "PATH_TRAVERSAL_NOT_ALLOWED";
        throw error;
    }

    // Ignore "." segments.
    const cleanSegments = segments.filter(
        (segment) => segment !== "."
    );

    if (cleanSegments.length === 0) {
        const error = new Error(
            "Project path cannot be empty"
        );
        error.code = "EMPTY_PROJECT_PATH";
        throw error;
    }

    return cleanSegments.join("/");
}

export function validateProjectPath(inputPath){
    return normalizeProjectPath(inputPath);
}