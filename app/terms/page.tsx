export default function TermsPage() {
  return (
    <div className="content-shell narrow-shell legal-page">
      <div className="page-heading">
        <p className="section-label">Terms and important limits</p>
        <h1>Know what IdeaProof does—and what it does not.</h1>
        <p>
          IdeaProof is a local documentation and timestamping tool, not a legal
          service or ownership registry.
        </p>
      </div>
      <section>
        <h2>AI-generated documents need review</h2>
        <p>
          Your selected AI provider generates the technical specification and
          sample NDA from the information you submit. Generated content can
          contain errors, omissions, or unsuitable suggestions. Review every
          line before approval.
        </p>
      </section>
      <section>
        <h2>The sample NDA is not legal advice</h2>
        <p>
          It is intentionally simple and may not fit your circumstances.
          Consult a qualified lawyer before relying on it.
        </p>
      </section>
      <section>
        <h2>Content and local storage</h2>
        <p>
          Document generation sends the required idea and NDA purpose to your
          selected AI provider using your API key. Projects are stored on this
          machine without application-level encryption.
        </p>
      </section>
      <section>
        <h2>What timestamps prove</h2>
        <p>
          A confirmed OpenTimestamps proof shows that the digital fingerprint
          of an exact PDF existed by a certain time. Timestamps do not prove
          ownership or legal validity. Changing a PDF means it will no longer
          match its existing proof.
        </p>
      </section>
      <section>
        <h2>OpenTimestamps confirmation can take time</h2>
        <p>
          OpenTimestamps receives the PDF&apos;s digital fingerprint, not the
          PDF or its contents. A proof may remain pending for several hours
          before it can be confirmed.
        </p>
      </section>
    </div>
  );
}
