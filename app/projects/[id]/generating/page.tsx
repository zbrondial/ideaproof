import { GenerationProgress } from "@/components/generation-progress";
import { getProjectStore } from "@/server/db/projects";

export const dynamic = "force-dynamic";

export default async function GeneratingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = getProjectStore().getProject(id);
  return (
    <div className="content-shell narrow-shell">
      <GenerationProgress
        projectId={id}
        provider={project.provider}
        model={project.model}
      />
    </div>
  );
}
