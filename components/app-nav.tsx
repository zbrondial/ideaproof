"use client";

import Link from "next/link";
import { useState } from "react";

export function AppNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Primary navigation">
        <Link className="wordmark" href="/" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="3" y="3" width="11" height="11" rx="2" />
            <rect x="18" y="3" width="11" height="11" rx="2" opacity=".42" />
            <rect x="3" y="18" width="11" height="11" rx="2" opacity=".42" />
            <rect x="18" y="18" width="11" height="11" rx="2" />
          </svg>
          IdeaProof
        </Link>
        <button
          className="menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="primary-links"
          onClick={() => setOpen((current) => !current)}
        >
          Menu
        </button>
        <div className="nav-links" id="primary-links" data-open={open}>
          <Link href="/projects" onClick={() => setOpen(false)}>
            Proof logs
          </Link>
          <Link href="/verify" onClick={() => setOpen(false)}>
            Verify
          </Link>
          <Link href="/terms" onClick={() => setOpen(false)}>
            Terms
          </Link>
          <Link
            className="button button-small"
            href="/projects/new"
            onClick={() => setOpen(false)}
          >
            Protect an idea
          </Link>
        </div>
      </nav>
    </header>
  );
}
