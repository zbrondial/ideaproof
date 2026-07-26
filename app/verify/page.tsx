import { VerifyForm } from "@/components/verify-form";

export default function VerifyPage() {
  return (
    <div className="content-shell narrow-shell">
      <div className="page-heading">
        <p className="section-label">Independent verification</p>
        <h1>Check a PDF against its timestamp proof.</h1>
        <p>
          Files are copied to a temporary local folder only for this check,
          then deleted. Verification does not send the PDF to OpenAI.
        </p>
      </div>
      <VerifyForm />
    </div>
  );
}
