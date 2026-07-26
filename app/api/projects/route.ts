import { NextResponse } from "next/server";
import { z } from "zod";

import { listConfiguredProviders } from "@/server/config";
import { getProjectStore, type ProjectStatus } from "@/server/db/projects";

const ownerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,'’\u002D]*$/u);

const projectInputSchema = z
  .object({
    ownerName: ownerNameSchema,
    idea: z.string().trim().min(20).max(10_000),
    technologyPreference: z.string().trim().max(1_000).default(""),
    ndaPurpose: z.string().trim().min(10).max(2_000),
    ndaDetails: z.string().trim().max(4_000).default(""),
    provider: z.enum(["openai", "anthropic"]),
    model: z.string().trim().min(1).max(120),
  })
  .strict();

const statuses = new Set<ProjectStatus>([
  "draft",
  "generating",
  "review",
  "pending",
  "confirmed",
  "failed",
]);

export async function POST(request: Request) {
  try {
    const input = projectInputSchema.parse(await request.json());
    const available = listConfiguredProviders().some(
      ({ provider, model }) =>
        provider === input.provider && model === input.model,
    );
    if (!available) {
      return NextResponse.json(
        {
          code: "PROJECT_MODEL_UNAVAILABLE",
          message: "Choose a model currently configured on this machine.",
        },
        { status: 400 },
      );
    }
    const project = getProjectStore().createProject(input);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        {
          code: "PROJECT_INPUT_INVALID",
          message:
            "Add an owner name, idea, and NDA purpose within the stated limits.",
        },
        { status: 400 },
      );
    }
    throw error;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const requestedStatus = url.searchParams.get("status");
  const status =
    requestedStatus && statuses.has(requestedStatus as ProjectStatus)
      ? (requestedStatus as ProjectStatus)
      : undefined;
  const projects = getProjectStore().listProjects({ search, status });
  return NextResponse.json({ projects });
}
