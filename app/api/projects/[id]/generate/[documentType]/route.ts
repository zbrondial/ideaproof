import { NextResponse } from "next/server";

import {
  getProjectStore,
  type DocumentType,
} from "@/server/db/projects";
import { AppError } from "@/server/errors";
import {
  generateDocument,
  type GeneratedDocument,
} from "@/server/generation/service";
import { e2eFixturesEnabled } from "@/server/runtime-mode";

type ProjectStore = ReturnType<typeof getProjectStore>;
type Generation = {
  specification(input: {
    idea: string;
    technologyPreference: string;
  }): Promise<GeneratedDocument>;
  nda(input: {
    idea: string;
    ndaPurpose: string;
    ndaDetails: string;
  }): Promise<GeneratedDocument>;
};

async function realGeneration(provider: "openai" | "anthropic", model: string) {
  const port = e2eFixturesEnabled()
    ? (await import("@/tests/fixtures/openai-responses")).fixtureResponsesPort
    : (await import("@/server/generation/provider")).createGenerationPort(
        provider,
        model,
      );
  return {
    specification: (input: {
      idea: string;
      technologyPreference: string;
    }) =>
      generateDocument({ documentType: "specification", ...input }, port),
    nda: (input: {
      idea: string;
      ndaPurpose: string;
      ndaDetails: string;
    }) => generateDocument({ documentType: "nda", ...input }, port),
  } satisfies Generation;
}

function safeError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { code: error.code, message: error.message, retryable: error.retryable },
      { status: error.status },
    );
  }
  return NextResponse.json(
    {
      code: "GENERATION_FAILED",
      message: "The document could not be generated.",
      retryable: true,
    },
    { status: 500 },
  );
}

function beginGeneration(store: ProjectStore, projectId: string) {
  const project = store.getProject(projectId);
  if (project.approval) {
    throw new AppError(
      "PROJECT_IMMUTABLE",
      "Approved projects cannot generate new revisions.",
      409,
    );
  }
  const status = project.status;
  if (status === "draft" || status === "review" || status === "failed") {
    store.transitionProject(projectId, status, "generating");
  } else if (status !== "generating") {
    throw new AppError(
      "PROJECT_STATE_INVALID",
      "This project cannot generate documents in its current state.",
      409,
    );
  }
}

export async function handleGenerate({
  projectId,
  documentType,
  store,
  generation,
}: {
  projectId: string;
  documentType: DocumentType;
  store: ProjectStore;
  generation?: Generation;
}) {
  try {
    beginGeneration(store, projectId);
    const project = store.getProject(projectId);
    const selectedGeneration =
      generation ?? (await realGeneration(project.provider, project.model));
    const generated =
      documentType === "specification"
        ? await selectedGeneration.specification({
            idea: project.idea,
            technologyPreference: project.technologyPreference,
          })
        : await selectedGeneration.nda({
            idea: project.idea,
            ndaPurpose: project.ndaPurpose,
            ndaDetails: project.ndaDetails,
          });
    const revision = store.addRevision({
      projectId,
      documentType,
      content: generated.markdown,
      wordCount: generated.wordCount,
      feedback: null,
      promptTemplateVersion: generated.promptTemplateVersion,
      provider: generated.provider,
      model: generated.model,
      providerResponseId: generated.providerResponseId,
    });
    store.selectRevision(projectId, documentType, revision.id);

    const detail = store.getProject(projectId);
    const hasBoth =
      detail.revisions.some(
        (item) => item.documentType === "specification",
      ) && detail.revisions.some((item) => item.documentType === "nda");
    if (hasBoth && detail.status === "generating") {
      store.transitionProject(projectId, "generating", "review");
    }

    return NextResponse.json(
      {
        documentType,
        revisionId: revision.id,
        version: revision.version,
        wordCount: revision.wordCount,
      },
      { status: 201 },
    );
  } catch (error) {
    try {
      const current = store.getProject(projectId);
      if (current.status === "generating") {
        store.transitionProject(projectId, "generating", "failed");
      }
    } catch {
      // Preserve the original safe error when the project lookup itself failed.
    }
    return safeError(error);
  }
}

export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; documentType: string }>;
  },
) {
  const { id, documentType } = await params;
  if (documentType !== "specification" && documentType !== "nda") {
    return NextResponse.json(
      { code: "DOCUMENT_TYPE_INVALID", message: "Unknown document type." },
      { status: 404 },
    );
  }
  return handleGenerate({
    projectId: id,
    documentType,
    store: getProjectStore(),
  });
}
