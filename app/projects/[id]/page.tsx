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
  redirect(
    project.status === "review" || project.status === "pending" || project.status === "confirmed"
      ? `/projects/${id}/review`
      : `/projects/${id}/generating`,
  );
}
