import Link from "next/link";

export default function HomePage() {
  const workflow = [
    [
      "Describe your idea",
      "Describe what you want to build and your preferred technology.",
    ],
    [
      "Generate your documents",
      "Receive a technical specification and mutual NDA.",
    ],
    [
      "Review and revise",
      "Check both documents and provide feedback if needed.",
    ],
    [
      "Approve the documents",
      "Confirm the technical specification and NDA are ready to protect.",
    ],
    [
      "Proof created",
      "Your exact approved PDFs receive OpenTimestamps proofs and await confirmation.",
    ],
  ];

  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <h1>
            Timestamp your <span>idea</span>.
            <br />
            Own the moment it happened.
          </h1>
          <p className="lede">
            Turn a software idea into a technical specification and mutual NDA,
            review the generated documents, and create a timestamped proof of
            the exact version you approved.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/projects/new">
              Protect an idea
            </Link>
            <Link className="button button-secondary" href="/verify">
              Verify a proof
            </Link>
          </div>
        </div>
      </section>
      <section className="workflow-section" aria-labelledby="workflow-title">
        <div className="workflow-inner">
          <div className="workflow-heading">
            <h2 id="workflow-title">How it works</h2>
            <span>EXAMPLE WORKFLOW</span>
          </div>
          <ol className="workflow-list">
            {workflow.map(([title, copy], index) => (
              <li key={title}>
                <span className="workflow-number" aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="trust-section" aria-label="How IdeaProof handles your data">
        <div>
          <span className="trust-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M10 2 4 5v5c0 3.55 2.55 6.88 6 7.7 3.45-.82 6-4.15 6-7.7V5l-6-3Z" />
            </svg>
          </span>
          <h2>Stored on this machine</h2>
          <p>
            Your projects and generated documents stay in your local IdeaProof
            data folder. Generation sends the required content to your selected
            AI provider using your API key.
          </p>
        </div>
        <div>
          <span className="trust-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="7" />
              <path d="M10 6v4.5l2.5 1.5" />
            </svg>
          </span>
          <h2>Every revision retained</h2>
          <p>
            All accepted versions are stored. See exactly what changed and when
            feedback was applied.
          </p>
        </div>
        <div>
          <span className="trust-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20">
              <path d="M3 10h14m-7-7 7 7-7 7" />
            </svg>
          </span>
          <h2>Proof anyone can verify</h2>
          <p>
            OpenTimestamps proofs let anyone check that an exact approved PDF
            has not changed.
          </p>
        </div>
      </section>
    </>
  );
}
