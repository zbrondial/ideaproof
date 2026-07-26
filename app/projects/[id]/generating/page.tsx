import { GenerationProgress } from "@/components/generation-progress";

export default async function GeneratingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="content-shell narrow-shell">
      <GenerationProgress projectId={id} />
    </div>
  );
}
