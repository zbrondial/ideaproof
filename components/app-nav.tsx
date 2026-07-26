"use client";

import Link from "next/link";
import { useState } from "react";

export function AppNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Primary navigation">
        <Link className="wordmark" href="/" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 22 22" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" rx="2" />
            <rect x="12" y="1" width="9" height="9" rx="2" opacity=".4" />
            <rect x="1" y="12" width="9" height="9" rx="2" opacity=".4" />
            <rect x="12" y="12" width="9" height="9" rx="2" />
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
          <span className="visually-hidden">Toggle navigation</span>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect y="3" width="20" height="2" rx="1" />
            <rect y="9" width="20" height="2" rx="1" />
            <rect y="15" width="20" height="2" rx="1" />
          </svg>
        </button>
        <div className="nav-links" id="primary-links" data-open={open}>
          <Link href="/projects" onClick={() => setOpen(false)}>
            Proof Logs
          </Link>
          <Link href="/verify" onClick={() => setOpen(false)}>
            Verify proof
          </Link>
          <Link href="/how-it-works" onClick={() => setOpen(false)}>
            How it works
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
