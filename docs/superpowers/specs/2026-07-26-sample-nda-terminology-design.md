# Sample NDA Terminology Design

## Goal

Use “Sample NDA” consistently everywhere a user sees or downloads the NDA
document. Clarify the Terms explanation so users understand that
OpenTimestamps proves the digital fingerprint of either exact approved PDF.

## User-facing terminology

Replace “Mutual NDA” and “Mutual Non-Disclosure Agreement” with:

- short labels: “Sample NDA”;
- full document and PDF title: “Sample Non-Disclosure Agreement”;
- generation copy: “sample NDA.”

This applies to the homepage, progress state, review tabs, revision history,
approval, proof pages, generated Markdown, rendered PDFs, prompts, fixtures,
documentation, and new proof-package filenames.

The internal document type remains `nda`. This identifier is not user-facing,
and retaining it avoids an unnecessary database migration and API break.

## Proof packages and compatibility

New proof packages contain:

- `sample-nda.md`;
- `sample-nda.pdf`;
- `sample-nda.pdf.ots`.

The manifest records those exact filenames. Existing downloaded packages and
stored approvals remain unchanged and valid. Code that rebuilds a failed
approval uses its stored artifact paths as input but emits the new public
package filenames.

## Prompt and document contract

The generation prompt requests a sample NDA and retains the current simple,
non-legal-advice constraints. The canonical generated title becomes “Sample
Non-Disclosure Agreement.” Increment the NDA prompt-template version because
the generated-document contract changes.

No NDA clauses, word limits, blank fields, provider behavior, or approval
semantics change.

## OpenTimestamps explanation

Use this approved Terms copy:

> A confirmed OpenTimestamps proof shows that the digital fingerprint of an
> exact approved PDF—your idea’s technical specification or sample NDA—existed
> by a certain time. Timestamps do not prove ownership or legal validity.
> Changing the PDF means it will no longer match its existing proof.

## Verification

Test the observable behavior:

- rendered pages use “Sample NDA” and no longer expose “Mutual NDA”;
- generated Markdown uses “Sample Non-Disclosure Agreement”;
- prompts use “sample NDA” and the incremented template version;
- rendered NDA PDFs use the new title;
- new proof ZIPs and manifests use the three `sample-nda` filenames;
- the approved OpenTimestamps explanation appears in Terms;
- existing document type and database behavior remain `nda`;
- the full unit, build, and browser suites remain green.
