console.log("=== SANDBOX ENVIRONMENT ===");

console.log("platform:", process.platform);
console.log("architecture:", process.arch);
console.log("node:", process.version);
console.log("shell:", process.env.SHELL ?? "undefined");
console.log("comspec:", process.env.ComSpec ?? "undefined");
console.log("path:", process.env.PATH ?? "undefined");