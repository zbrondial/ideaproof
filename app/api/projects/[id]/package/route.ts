import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { NextResponse } from "next/server";

import { getProjectStore } from "@/server/db/projects";
import { AppError } from "@/server/errors";
import { loadStorageConfig } from "@/server/config";

type Store = ReturnType<typeof getProjectStore>;

function packageSlug(title: string, id: string) {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${titleSlug || "idea"}-${id.slice(0, 8)}-proof`;
}

export async function handlePackage(
  projectId: string,
  store: Store,
  dataDir?: string,
) {
  try {
    const project = store.getProject(projectId);
    if (!project.approval) {
      throw new AppError(
        "APPROVAL_NOT_FOUND",
        "This project does not have a proof package yet.",
        404,
      );
    }
    const packagePath =
      dataDir && !isAbsolute(project.approval.packagePath)
        ? join(dataDir, project.approval.packagePath)
        : project.approval.packagePath;
    const bytes = await readFile(packagePath);
    return new Response(new Blob([new Uint8Array(bytes)]), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${packageSlug(project.title, project.id)}.zip"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        code: "PACKAGE_NOT_FOUND",
        message: "The proof package is not available.",
      },
      { status: 404 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handlePackage(id, getProjectStore(), loadStorageConfig().dataDir);
}
