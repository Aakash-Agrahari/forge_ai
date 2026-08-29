import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
    schema: "infrastructure/prisma/schema.prisma",

    migrations: {
        path: "infrastructure/prisma/migrations"
    },

    datasource: {
        url: env("DATABASE_URL")
    }
});