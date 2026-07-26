"use client";

import { useEffect, useState } from "react";

type SetupCheck = {
  ok: boolean;
  code: string;
  message: string;
  command?: string;
};

export function SetupChecks() {
  const [checks, setChecks] = useState<SetupCheck[]>();

  useEffect(() => {
    let active = true;
    fetch("/api/setup", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (active) setChecks(body.checks);
      })
      .catch(() => {
        if (active) setChecks([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!checks) {
    return <p className="setup-loading">Checking this machine…</p>;
  }
  if (checks.length === 0) {
    return (
      <p className="form-error" role="alert">
        Setup checks could not reach the local IdeaProof server.
      </p>
    );
  }
  return (
    <div className="setup-checks">
      {checks.map((check) => (
        <article key={check.code} data-ready={check.ok}>
          <span aria-hidden="true">{check.ok ? "✓" : "!"}</span>
          <div>
            <h2>{check.message}</h2>
            {check.command ? <code>{check.command}</code> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
