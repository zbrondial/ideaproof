import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="section-label">Local-first idea protection</p>
          <h1>
            Turn your idea into an <span>exact moment</span> you can verify.
          </h1>
          <p className="lede">
            Generate a concise technical specification and mutual NDA, review
            every word, then timestamp the exact files you approve.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/projects/new">
              Protect an idea
            </Link>
            <Link className="button button-secondary" href="/projects">
              View proof logs
            </Link>
          </div>
        </div>
      </section>
      <section className="workflow-section" aria-labelledby="workflow-title">
        <div className="section-heading">
          <h2 id="workflow-title">A deliberate path from thought to proof.</h2>
          <p>Nothing is approved until you choose the exact revisions.</p>
        </div>
        <ol className="workflow-list">
          {[
            ["Describe", "Capture the idea and the NDA’s purpose."],
            ["Generate", "Create two concise documents with OpenAI."],
            ["Review", "Read, revise, and compare every saved version."],
            ["Approve", "Freeze the specification and NDA you select."],
            ["Verify", "Timestamp the PDFs and keep their proof package."],
          ].map(([title, copy]) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="trust-section" aria-label="How IdeaProof handles your data">
        <div>
          <h2>Stored on this machine</h2>
          <p>
            Your projects and generated documents stay in your local IdeaProof
            data folder. Generation sends the required content to OpenAI using
            your API key.
          </p>
        </div>
        <div>
          <h2>Exact files, exact proof</h2>
          <p>
            Approval freezes selected revisions before their PDF fingerprints
            and timestamps are created.
          </p>
        </div>
        <div>
          <h2>Honest boundaries</h2>
          <p>
            A timestamp proves when exact bytes existed. It does not establish
            ownership, patent rights, or legal enforceability.
          </p>
        </div>
      </section>
    </>
  );
}
