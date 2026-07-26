import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, expect, it } from "vitest";

import { jsonRequest } from "../helpers/http";

let POST: typeof import("@/app/api/projects/route").POST;
let GET: typeof import("@/app/api/projects/route").GET;

beforeAll(async () => {
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.IDEAPROOF_DATA_DIR = mkdtempSync(
    join(tmpdir(), "ideaproof-api-test-"),
  );
  ({ POST, GET } = await import("@/app/api/projects/route"));
});

it("requires idea and NDA purpose", async () => {
  const response = await POST(jsonRequest({ idea: "", ndaPurpose: "" }));

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "PROJECT_INPUT_INVALID",
  });
});

it("creates a local draft without legal-detail fields", async () => {
  const response = await POST(
    jsonRequest({
      idea: "A browser app that timestamps concise idea documents",
      technologyPreference: "",
      ndaPurpose: "Discuss a possible collaboration",
      ndaDetails: "",
    }),
  );

  expect(response.status).toBe(201);
  const project = await response.json();
  expect(project).toMatchObject({ status: "draft" });
  expect(project).not.toHaveProperty("packagePath");
  expect(project).not.toHaveProperty("dataDir");
});

it("lists matching projects through safe summaries", async () => {
  const response = await GET(
    new Request("http://127.0.0.1:3000/api/projects?search=timestamps"),
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.projects).toEqual([
    expect.objectContaining({ status: "draft" }),
  ]);
  expect(body.projects[0]).not.toHaveProperty("idea");
});
