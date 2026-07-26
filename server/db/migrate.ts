import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export function migrate(
  database: DatabaseSync,
  migrationsDirectory = join(process.cwd(), "server/db/migrations"),
) {
  const currentVersion = database
    .prepare("PRAGMA user_version")
    .get() as { user_version: number };
  const migrations = readdirSync(migrationsDirectory)
    .filter((name) => /^\d{3}-.+\.sql$/.test(name))
    .sort();

  for (const filename of migrations) {
    const version = Number.parseInt(filename.slice(0, 3), 10);
    if (version <= currentVersion.user_version) continue;

    const sql = readFileSync(join(migrationsDirectory, filename), "utf8");
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(sql);
      database.exec(`PRAGMA user_version = ${version}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
