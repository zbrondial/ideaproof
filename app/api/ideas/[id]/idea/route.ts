import { NextResponse } from "next/server";
import { z } from "zod";

import { getProjectStore } from "@/server/db/projects";
import { AppError } from "@/server/errors";

const inputSchema = z
  .object({
    ideaName: z.string().trim().min(1).max(120),
    idea: z.string().trim().min(20).max(10_000),
    updateNote: z.string().trim().max(500).optional().default(""),
  })
  .strict();

type ProjectStore = ReturnType<typeof getProjectStore>;

export async function handleIdeaUpdate({
  projectId,
  body,
  store,
}: {
  projectId: string;
  body: unknown;
  store: ProjectStore;
}) {
  try {
    const input = inputSchema.parse(body);
    store.updateIdea(projectId, input);
    const versions = store.getIdeaVersions(projectId);
    const latest = versions.at(-1)!;
    return NextResponse.json({
      ideaVersionId: latest.id,
      version: latest.version,
      ideaName: latest.ideaName,
      updatedAt: latest.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "PROJECT_IDEA_INVALID",
          message: "Add an Idea name and at least 20 characters for the idea.",
        },
        { status: 400 },
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        code: "PROJECT_IDEA_INVALID",
        message: "Add an Idea name and at least 20 characters for the idea.",
      },
      { status: 400 },
    );
  }
  return handleIdeaUpdate({
    projectId: id,
    body,
    store: getProjectStore(),
  });
}
