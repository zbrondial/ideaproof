import { VerifyForm } from "@/components/verify-form";

export default function VerifyPage() {
  return (
    <div className="content-shell narrow-shell">
      <div className="page-heading">
        <p className="section-label">Independent verification</p>
        <h1>Verify proof</h1>
        <p>
          Choose an approved PDF and its matching OpenTimestamps proof.
          IdeaProof checks them temporarily on this machine, then deletes the
          temporary copies. Verification does not send the PDF to an AI
          provider or OpenTimestamps.
        </p>
      </div>
      <VerifyForm />
    </div>
  );
}
