import Link from "next/link";

const steps = [
  {
    title: "Describe",
    copy: "Enter your idea, NDA purpose, and optional details. Your idea is stored locally.",
  },
  {
    title: "Choose and generate",
    copy: "Choose one available model for the project. IdeaProof sends the required content to that provider and generates a technical specification and sample NDA.",
  },
  {
    title: "Review and revise",
    copy: "Read both documents, request changes, and inspect saved versions.",
  },
  {
    title: "Approve exact PDFs",
    copy: "Choose exact revisions. IdeaProof creates final PDFs and locks approval.",
  },
  {
    title: "Timestamp and verify",
    copy: "IdeaProof creates a digital fingerprint of each approved PDF and timestamps it with OpenTimestamps. Your PDFs stay on your machine, and anyone with the PDF and its proof can later verify that the document has not changed.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="content-shell how-page">
      <header className="page-heading how-heading">
        <h1>How IdeaProof works</h1>
        <p>
          From an early description to exact, independently verifiable PDF
          files—without moving your project out of your local IdeaProof folder.
        </p>
      </header>
      <ol className="how-flow">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="how-number" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.copy}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="how-actions">
        <Link className="button" href="/projects/new">
          Timestamp an idea
        </Link>
        <Link className="button button-secondary" href="/verify">
          Verify a proof
        </Link>
      </div>
    </div>
  );
}
