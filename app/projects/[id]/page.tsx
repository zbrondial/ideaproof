import { redirect } from "next/navigation";

import { getProjectStore } from "@/server/db/projects";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProjectStore().getProject(id);
  if (project.approval) {
    redirect(`/projects/${id}/proof`);
  }
  redirect(
    project.status === "review"
      ? `/projects/${id}/review`
      : `/projects/${id}/generating`,
  );
}
