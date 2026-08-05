import path from "node:path";
import dotenv from "dotenv";
import type { Config } from "drizzle-kit";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default {
  schema: "./src/schema.ts",
  out: "../../migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://pios:pios@localhost:5432/pios",
  },
} satisfies Config;
