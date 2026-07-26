import { NextResponse } from "next/server";
import { z } from "zod";

import { getProjectStore } from "@/server/db/projects";
import { AppError } from "@/server/errors";
import {
  reviseDocument,
  type GeneratedDocument,
  type GenerationInput,
} from "@/server/generation/service";

const revisionRequestSchema = z
  .object({
    documentType: z.enum(["specification", "nda"]),
    revisionId: z.string().uuid(),
    feedback: z.string().trim().min(3).max(4_000),
  })
  .strict();

type ProjectStore = ReturnType<typeof getProjectStore>;
type RevisionInput = GenerationInput & {
  currentMarkdown: string;
  feedback: string;
};
type RevisionGeneration = {
  revise(input: RevisionInput): Promise<GeneratedDocument>;
};

const realGeneration: RevisionGeneration = {
  revise: ({ currentMarkdown, ...input }) =>
    reviseDocument({ ...input, currentRevision: currentMarkdown }),
};

export async function handleRevision({
  projectId,
  body,
  store,
  generation,
}: {
  projectId: string;
  body: unknown;
  store: ProjectStore;
  generation: RevisionGeneration;
}) {
  try {
    const input = revisionRequestSchema.parse(body);
    const project = store.getProject(projectId);
    const revision = project.revisions.find(
      (item) =>
        item.id === input.revisionId &&
        item.documentType === input.documentType,
    );
    if (!revision) {
      throw new AppError(
        "REVISION_PROJECT_MISMATCH",
        "The selected revision does not belong to this document.",
        409,
      );
    }

    if (project.status === "draft") {
      store.transitionProject(projectId, "draft", "generating");
    } else if (project.status === "review" || project.status === "failed") {
      store.transitionProject(projectId, project.status, "generating");
    }

    const generated = await generation.revise({
      documentType: input.documentType,
      idea: project.idea,
      technologyPreference: project.technologyPreference,
      ndaPurpose: project.ndaPurpose,
      ndaDetails: project.ndaDetails,
      currentMarkdown: revision.content,
      feedback: input.feedback,
    });
    const nextRevision = store.addRevision({
      projectId,
      documentType: input.documentType,
      content: generated.markdown,
      wordCount: generated.wordCount,
      feedback: input.feedback,
      promptTemplateVersion: generated.promptTemplateVersion,
      model: generated.model,
      openaiResponseId: generated.openaiResponseId,
    });
    store.selectRevision(projectId, input.documentType, nextRevision.id);
    if (store.getProject(projectId).status === "generating") {
      store.transitionProject(projectId, "generating", "review");
    }
    return NextResponse.json(
      {
        documentType: nextRevision.documentType,
        revisionId: nextRevision.id,
        version: nextRevision.version,
        wordCount: nextRevision.wordCount,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "REVISION_INPUT_INVALID",
          message: "Choose a revision and add specific feedback.",
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
    return NextResponse.json(
      { code: "REVISION_FAILED", message: "The revision could not be created." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRevision({
    projectId: id,
    body: await request.json(),
    store: getProjectStore(),
    generation: realGeneration,
  });
}
