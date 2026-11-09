import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // DATABASE_URL is the target-hosting convention; keep the legacy variable
    // as a temporary fallback until the source platform is fully retired.
    url: process.env.DATABASE_URL ?? process.env.LOVABLE_DB_MIGRATION_URL ?? "",
  },
});
