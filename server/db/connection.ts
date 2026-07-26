import "server-only";

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { loadConfig } from "@/server/config";

import { migrate } from "./migrate";

let database: DatabaseSync | undefined;

export function getDatabase(): DatabaseSync {
  if (database) return database;

  const { dataDir } = loadConfig();
  mkdirSync(dataDir, { recursive: true });
  database = new DatabaseSync(join(dataDir, "ideaproof.sqlite"));
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  migrate(database);
  return database;
}
