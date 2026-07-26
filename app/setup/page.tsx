import { SetupChecks } from "@/components/setup-checks";

export default function SetupPage() {
  return (
    <div className="content-shell narrow-shell">
      <div className="page-heading">
        <p className="section-label">Local setup</p>
        <h1>Check what IdeaProof needs on this machine.</h1>
        <p>
          These checks report presence and readiness only. Secret values and
          internal paths are never returned.
        </p>
      </div>
      <SetupChecks />
      <p className="setup-help">
        Need more context? Open <code>README.md</code> and see Troubleshooting.
      </p>
    </div>
  );
}
