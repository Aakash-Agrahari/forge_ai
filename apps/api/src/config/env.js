import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, "../../../../.env");

dotenv.config({
    path: rootEnvPath
});


const requiredEnvVariables = [
    "SESSION_SECRET"
];

for(const variable of requiredEnvVariables) {
    if(!process.env[variable]) {
        throw new Error(`Missing required environment variable: ${variable}`);
    }
}

// This is a centralized configuration file that loads environment variables from the .env file and makes them available throughout the application. It also provides default values for certain variables if they are not set in the environment.
const env = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT) || 3000,

    databaseUrl: process.env.DATABASE_URL || "",
    redisUrl: process.env.REDIS_URL || "",

    sessionSecret: process.env.SESSION_SECRET,

    geminiApiKey: process.env.GEMINI_API_KEY || "",
    groqApiKey: process.env.GROQ_API_KEY || "",
    cerebrasApiKey: process.env.CEREBRAS_API_KEY || "",
    openRouterApiKey: process.env.OPENROUTER_API_KEY || "",

    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434"
};

export default Object.freeze(env);