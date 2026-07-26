import { ProjectForm } from "@/components/project-form";
import { listConfiguredProviders } from "@/server/config";

export default function NewProjectPage() {
  return (
    <div className="content-shell narrow-shell">
      <div className="page-heading">
        <p className="section-label">New project</p>
        <h1>Describe your idea as it exists now.</h1>
        <p>
          These details become the source for your generated technical
          specification and sample NDA. You will review both documents before
          approving the exact PDF versions to timestamp.
        </p>
      </div>
      <ProjectForm providers={listConfiguredProviders()} />
    </div>
  );
}
