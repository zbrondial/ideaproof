import { ProjectForm } from "@/components/project-form";

export default function NewProjectPage() {
  return (
    <div className="content-shell narrow-shell">
      <div className="page-heading">
        <p className="section-label">New project</p>
        <h1>Put your idea into clear, reviewable words.</h1>
        <p>
          Give IdeaProof the essential facts. You will review both concise
          documents before anything is approved or timestamped.
        </p>
      </div>
      <ProjectForm />
    </div>
  );
}
