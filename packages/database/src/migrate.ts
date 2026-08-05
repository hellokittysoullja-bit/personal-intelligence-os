import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../../migrations");

export async function runMigrations(databaseUrl: string): Promise<void> {
  const migrationClient = postgres(databaseUrl, { max: 1 });
  try {
    const db = drizzle(migrationClient);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await migrationClient.end();
  }
}

/** CLI entry point: `pnpm db:migrate` (tsx src/migrate.ts). */
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  runMigrations(databaseUrl)
    .then(() => {
      console.log("Migrations applied successfully");
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
