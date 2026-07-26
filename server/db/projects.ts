import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { AppError } from "@/server/errors";

import { migrate } from "./migrate";

export type ProjectStatus =
  | "draft"
  | "generating"
  | "review"
  | "pending"
  | "confirmed"
  | "failed";
export type DocumentType = "specification" | "nda";
export type ProofStatus = "pending" | "confirmed" | "failed";

export type Project = {
  id: string;
  title: string;
  idea: string;
  technologyPreference: string;
  ndaPurpose: string;
  ndaDetails: string;
  status: ProjectStatus;
  selectedSpecificationRevisionId: string | null;
  selectedNdaRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Revision = {
  id: string;
  projectId: string;
  documentType: DocumentType;
  version: number;
  content: string;
  wordCount: number;
  feedback: string | null;
  promptTemplateVersion: string;
  model: string;
  openaiResponseId: string | null;
  createdAt: string;
};

export type Approval = {
  id: string;
  projectId: string;
  specificationRevisionId: string;
  ndaRevisionId: string;
  approvedAt: string;
  packagePath: string;
};

export type ProofArtifact = {
  id: string;
  approvalId: string;
  documentType: DocumentType;
  pdfPath: string;
  markdownPath: string;
  otsPath: string;
  sha256: string;
  status: ProofStatus;
  bitcoinBlockHeight: number | null;
  confirmedAt: string | null;
  lastCheckedAt: string | null;
  errorCode: string | null;
};

export type ProjectSummary = Pick<
  Project,
  "id" | "title" | "status" | "createdAt" | "updatedAt"
>;
export type ProjectDetail = Project & {
  revisions: Revision[];
  approval: Approval | null;
  proofArtifacts: ProofArtifact[];
};

type ProjectRow = {
  id: string;
  title: string;
  idea: string;
  technology_preference: string;
  nda_purpose: string;
  nda_details: string;
  status: ProjectStatus;
  selected_specification_revision_id: string | null;
  selected_nda_revision_id: string | null;
  created_at: string;
  updated_at: string;
};

type RevisionRow = {
  id: string;
  project_id: string;
  document_type: DocumentType;
  version: number;
  content: string;
  word_count: number;
  feedback: string | null;
  prompt_template_version: string;
  model: string;
  openai_response_id: string | null;
  created_at: string;
};

type ApprovalRow = {
  id: string;
  project_id: string;
  specification_revision_id: string;
  nda_revision_id: string;
  approved_at: string;
  package_path: string;
};

type ProofArtifactRow = {
  id: string;
  approval_id: string;
  document_type: DocumentType;
  pdf_path: string;
  markdown_path: string;
  ots_path: string;
  sha256: string;
  status: ProofStatus;
  bitcoin_block_height: number | null;
  confirmed_at: string | null;
  last_checked_at: string | null;
  error_code: string | null;
};

export const allowedTransitions = {
  draft: ["generating"],
  generating: ["review", "failed"],
  review: ["generating", "pending", "failed"],
  pending: ["confirmed", "failed"],
  confirmed: [],
  failed: ["generating", "pending"],
} as const satisfies Record<ProjectStatus, readonly ProjectStatus[]>;

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    idea: row.idea,
    technologyPreference: row.technology_preference,
    ndaPurpose: row.nda_purpose,
    ndaDetails: row.nda_details,
    status: row.status,
    selectedSpecificationRevisionId: row.selected_specification_revision_id,
    selectedNdaRevisionId: row.selected_nda_revision_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function revisionFromRow(row: RevisionRow): Revision {
  return {
    id: row.id,
    projectId: row.project_id,
    documentType: row.document_type,
    version: row.version,
    content: row.content,
    wordCount: row.word_count,
    feedback: row.feedback,
    promptTemplateVersion: row.prompt_template_version,
    model: row.model,
    openaiResponseId: row.openai_response_id,
    createdAt: row.created_at,
  };
}

function approvalFromRow(row: ApprovalRow): Approval {
  return {
    id: row.id,
    projectId: row.project_id,
    specificationRevisionId: row.specification_revision_id,
    ndaRevisionId: row.nda_revision_id,
    approvedAt: row.approved_at,
    packagePath: row.package_path,
  };
}

function proofFromRow(row: ProofArtifactRow): ProofArtifact {
  return {
    id: row.id,
    approvalId: row.approval_id,
    documentType: row.document_type,
    pdfPath: row.pdf_path,
    markdownPath: row.markdown_path,
    otsPath: row.ots_path,
    sha256: row.sha256,
    status: row.status,
    bitcoinBlockHeight: row.bitcoin_block_height,
    confirmedAt: row.confirmed_at,
    lastCheckedAt: row.last_checked_at,
    errorCode: row.error_code,
  };
}

function deriveTitle(idea: string) {
  const normalized = idea.replace(/\s+/g, " ").trim();
  return normalized.slice(0, 80) || "Untitled idea";
}

function inTransaction<T>(database: DatabaseSync, operation: () => T): T {
  database.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function createProjectStore(filename: string) {
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON;");
  migrate(database);

  function getProjectRow(id: string) {
    const row = database
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as ProjectRow | undefined;
    if (!row) {
      throw new AppError("PROJECT_NOT_FOUND", "Project not found.", 404);
    }
    return row;
  }

  function getRevisionRow(id: string) {
    const row = database
      .prepare("SELECT * FROM revisions WHERE id = ?")
      .get(id) as RevisionRow | undefined;
    if (!row) {
      throw new AppError("REVISION_NOT_FOUND", "Revision not found.", 404);
    }
    return row;
  }

  return {
    createProject(input: {
      idea: string;
      technologyPreference?: string;
      ndaPurpose: string;
      ndaDetails?: string;
    }): Project {
      const id = randomUUID();
      const now = new Date().toISOString();
      database
        .prepare(
          `INSERT INTO projects
            (id, title, idea, technology_preference, nda_purpose, nda_details,
             status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
        )
        .run(
          id,
          deriveTitle(input.idea),
          input.idea,
          input.technologyPreference ?? "",
          input.ndaPurpose,
          input.ndaDetails ?? "",
          now,
          now,
        );
      return projectFromRow(getProjectRow(id));
    },

    listProjects(query: { search?: string } = {}): ProjectSummary[] {
      const search = query.search?.trim();
      const rows = search
        ? (database
            .prepare(
              `SELECT id, title, status, created_at, updated_at
               FROM projects
               WHERE title LIKE ? OR idea LIKE ?
               ORDER BY updated_at DESC`,
            )
            .all(`%${search}%`, `%${search}%`) as Array<
            Pick<
              ProjectRow,
              "id" | "title" | "status" | "created_at" | "updated_at"
            >
          >)
        : (database
            .prepare(
              `SELECT id, title, status, created_at, updated_at
               FROM projects ORDER BY updated_at DESC`,
            )
            .all() as Array<
            Pick<
              ProjectRow,
              "id" | "title" | "status" | "created_at" | "updated_at"
            >
          >);

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    getProject(id: string): ProjectDetail {
      const project = projectFromRow(getProjectRow(id));
      const revisions = database
        .prepare(
          `SELECT * FROM revisions
           WHERE project_id = ?
           ORDER BY document_type, version`,
        )
        .all(id) as RevisionRow[];
      const approvalRow = database
        .prepare("SELECT * FROM approvals WHERE project_id = ?")
        .get(id) as ApprovalRow | undefined;
      const proofs = approvalRow
        ? (database
            .prepare(
              "SELECT * FROM proof_artifacts WHERE approval_id = ? ORDER BY document_type",
            )
            .all(approvalRow.id) as ProofArtifactRow[])
        : [];

      return {
        ...project,
        revisions: revisions.map(revisionFromRow),
        approval: approvalRow ? approvalFromRow(approvalRow) : null,
        proofArtifacts: proofs.map(proofFromRow),
      };
    },

    getRevisions(projectId: string, documentType: DocumentType): Revision[] {
      getProjectRow(projectId);
      return (
        database
          .prepare(
            `SELECT * FROM revisions
             WHERE project_id = ? AND document_type = ?
             ORDER BY version`,
          )
          .all(projectId, documentType) as RevisionRow[]
      ).map(revisionFromRow);
    },

    addRevision(input: {
      projectId: string;
      documentType: DocumentType;
      content: string;
      wordCount: number;
      feedback: string | null;
      promptTemplateVersion: string;
      model: string;
      openaiResponseId: string | null;
    }): Revision {
      return inTransaction(database, () => {
        getProjectRow(input.projectId);
        const versionRow = database
          .prepare(
            `SELECT COALESCE(MAX(version), 0) + 1 AS version
             FROM revisions WHERE project_id = ? AND document_type = ?`,
          )
          .get(input.projectId, input.documentType) as { version: number };
        const id = randomUUID();
        const now = new Date().toISOString();
        database
          .prepare(
            `INSERT INTO revisions
              (id, project_id, document_type, version, content, word_count,
               feedback, prompt_template_version, model, openai_response_id,
               created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            input.projectId,
            input.documentType,
            versionRow.version,
            input.content,
            input.wordCount,
            input.feedback,
            input.promptTemplateVersion,
            input.model,
            input.openaiResponseId,
            now,
          );
        return revisionFromRow(getRevisionRow(id));
      });
    },

    selectRevision(
      projectId: string,
      documentType: DocumentType,
      revisionId: string,
    ) {
      getProjectRow(projectId);
      const revision = getRevisionRow(revisionId);
      if (
        revision.project_id !== projectId ||
        revision.document_type !== documentType
      ) {
        throw new AppError(
          "REVISION_PROJECT_MISMATCH",
          "Revision does not belong to this project and document type.",
          409,
        );
      }
      const column =
        documentType === "specification"
          ? "selected_specification_revision_id"
          : "selected_nda_revision_id";
      database
        .prepare(`UPDATE projects SET ${column} = ?, updated_at = ? WHERE id = ?`)
        .run(revisionId, new Date().toISOString(), projectId);
    },

    transitionProject(
      id: string,
      from: ProjectStatus,
      to: ProjectStatus,
    ) {
      if (!(allowedTransitions[from] as readonly ProjectStatus[]).includes(to)) {
        throw new AppError(
          "PROJECT_STATE_INVALID",
          `A project cannot move from ${from} to ${to}.`,
          409,
        );
      }
      const changed = database
        .prepare(
          `UPDATE projects SET status = ?, updated_at = ?
           WHERE id = ? AND status = ?`,
        )
        .run(to, new Date().toISOString(), id, from);
      if (changed.changes !== 1) {
        throw new AppError(
          "PROJECT_STATE_INVALID",
          `Project is not in ${from} state.`,
          409,
        );
      }
    },

    updateProjectTitle(id: string, title: string): Project {
      getProjectRow(id);
      const approval = database
        .prepare("SELECT id FROM approvals WHERE project_id = ?")
        .get(id);
      if (approval) {
        throw new AppError(
          "PROJECT_IMMUTABLE",
          "Approved projects cannot be edited.",
          409,
        );
      }
      database
        .prepare("UPDATE projects SET title = ?, updated_at = ? WHERE id = ?")
        .run(deriveTitle(title), new Date().toISOString(), id);
      return projectFromRow(getProjectRow(id));
    },

    createApproval(input: {
      projectId: string;
      specificationRevisionId: string;
      ndaRevisionId: string;
      packagePath: string;
      artifacts: Array<{
        documentType: DocumentType;
        pdfPath: string;
        markdownPath: string;
        otsPath: string;
        sha256: string;
      }>;
    }): Approval {
      return inTransaction(database, () => {
        getProjectRow(input.projectId);
        const existing = database
          .prepare("SELECT id FROM approvals WHERE project_id = ?")
          .get(input.projectId);
        if (existing) {
          throw new AppError(
            "APPROVAL_EXISTS",
            "This project is already approved.",
            409,
          );
        }

        const specification = getRevisionRow(input.specificationRevisionId);
        const nda = getRevisionRow(input.ndaRevisionId);
        if (
          specification.project_id !== input.projectId ||
          specification.document_type !== "specification" ||
          nda.project_id !== input.projectId ||
          nda.document_type !== "nda"
        ) {
          throw new AppError(
            "REVISION_PROJECT_MISMATCH",
            "Approval revisions must belong to the same project.",
            409,
          );
        }

        const id = randomUUID();
        const approvedAt = new Date().toISOString();
        database
          .prepare(
            `INSERT INTO approvals
              (id, project_id, specification_revision_id, nda_revision_id,
               approved_at, package_path)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            input.projectId,
            input.specificationRevisionId,
            input.ndaRevisionId,
            approvedAt,
            input.packagePath,
          );

        const insertProof = database.prepare(
          `INSERT INTO proof_artifacts
            (id, approval_id, document_type, pdf_path, markdown_path, ots_path,
             sha256, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        );
        for (const artifact of input.artifacts) {
          insertProof.run(
            randomUUID(),
            id,
            artifact.documentType,
            artifact.pdfPath,
            artifact.markdownPath,
            artifact.otsPath,
            artifact.sha256,
          );
        }
        return approvalFromRow(
          database
            .prepare("SELECT * FROM approvals WHERE id = ?")
            .get(id) as ApprovalRow,
        );
      });
    },

    close() {
      database.close();
    },
  };
}
