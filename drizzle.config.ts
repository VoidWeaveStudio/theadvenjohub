import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  out: "./src/core/database/drizzle",  
  schema: "./src/core/database/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});