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
          OpenAI generates the technical specification and NDA template from
          the information you submit. Generated content can be incomplete or
          wrong. Review every line before approval.
        </p>
      </section>
      <section>
        <h2>The NDA is a template, not legal advice</h2>
        <p>
          It is intentionally simple and may not fit your circumstances.
          Consult a qualified lawyer before relying on it.
        </p>
      </section>
      <section>
        <h2>Content and local storage</h2>
        <p>
          Document generation sends the required idea and NDA content to
          OpenAI using your API key. Projects are stored on this machine
          without application-level encryption.
        </p>
      </section>
      <section>
        <h2>What timestamps prove</h2>
        <p>
          A confirmed proof shows that exact file bytes existed by a certain
          time. It does not establish ownership, authorship, patent rights, or
          legal validity. Changing a PDF invalidates its existing proof.
        </p>
      </section>
      <section>
        <h2>Public calendars and confirmation time</h2>
        <p>
          Timestamp calendars receive cryptographic commitments, not your
          document, but timing and network metadata may still be observable.
          Bitcoin confirmation may take hours.
        </p>
      </section>
    </div>
  );
}
