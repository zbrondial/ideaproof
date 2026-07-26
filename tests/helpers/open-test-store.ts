import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createProjectStore } from "@/server/db/projects";

export function openTestStore() {
  const directory = mkdtempSync(join(tmpdir(), "ideaproof-test-"));
  const store = createProjectStore(join(directory, "test.sqlite"));

  return Object.assign(store, {
    closeAndRemove() {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    },
  });
}
