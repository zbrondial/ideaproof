import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, expect, it } from "vitest";

import { jsonRequest } from "../helpers/http";

let POST: typeof import("@/app/api/projects/route").POST;
let GET: typeof import("@/app/api/projects/route").GET;

const validProjectInput = {
  idea: "A browser app that timestamps concise idea documents",
  technologyPreference: "",
  ndaPurpose: "Discuss a possible collaboration",
  ndaDetails: "",
};

beforeAll(async () => {
  process.env.IDEAPROOF_DATA_DIR = mkdtempSync(
    join(tmpdir(), "ideaproof-api-test-"),
  );
  ({ POST, GET } = await import("@/app/api/projects/route"));
});

beforeEach(() => {
  process.env.OPENAI_API_KEY = "openai-test-key";
  process.env.OPENAI_MODEL = "gpt-5.6";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
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
      ...validProjectInput,
      provider: "openai",
      model: "gpt-5.6",
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

it("accepts only a configured provider and model", async () => {
  const rejected = await POST(
    jsonRequest({
      ...validProjectInput,
      provider: "anthropic",
      model: "claude-opus-4-8",
    }),
  );
  expect(rejected.status).toBe(400);
  expect(await rejected.json()).toMatchObject({
    code: "PROJECT_MODEL_UNAVAILABLE",
  });

  const accepted = await POST(
    jsonRequest({
      ...validProjectInput,
      provider: "openai",
      model: "gpt-5.6",
    }),
  );
  expect(accepted.status).toBe(201);
  expect(await accepted.json()).toMatchObject({
    provider: "openai",
    model: "gpt-5.6",
  });
});

it("accepts Claude when Anthropic is the only configured provider", async () => {
  delete process.env.OPENAI_API_KEY;
  process.env.ANTHROPIC_API_KEY = "anthropic-test-key";
  process.env.ANTHROPIC_MODEL = "claude-opus-4-8";

  const response = await POST(
    jsonRequest({
      ...validProjectInput,
      provider: "anthropic",
      model: "claude-opus-4-8",
    }),
  );

  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    provider: "anthropic",
    model: "claude-opus-4-8",
  });
});

it("rejects project creation when no provider is configured", async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const response = await POST(
    jsonRequest({
      ...validProjectInput,
      provider: "openai",
      model: "gpt-5.6",
    }),
  );

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "PROJECT_MODEL_UNAVAILABLE",
  });
});
