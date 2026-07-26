import { NextResponse } from "next/server";
import { z } from "zod";

import { getProjectStore, type ProjectStatus } from "@/server/db/projects";

const projectInputSchema = z
  .object({
    idea: z.string().trim().min(20).max(10_000),
    technologyPreference: z.string().trim().max(1_000).default(""),
    ndaPurpose: z.string().trim().min(10).max(2_000),
    ndaDetails: z.string().trim().max(4_000).default(""),
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
    const project = getProjectStore().createProject(input);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        {
          code: "PROJECT_INPUT_INVALID",
          message: "Add an idea and NDA purpose within the stated limits.",
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
