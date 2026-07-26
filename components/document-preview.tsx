import ReactMarkdown from "react-markdown";

export function DocumentPreview({ markdown }: { markdown: string }) {
  return (
    <article className="document-preview">
      <ReactMarkdown
        allowedElements={[
          "h1",
          "h2",
          "h3",
          "p",
          "ul",
          "ol",
          "li",
          "strong",
          "em",
          "blockquote",
          "a",
        ]}
        components={{
          a: ({ children, href }) => (
            <a href={href} rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
