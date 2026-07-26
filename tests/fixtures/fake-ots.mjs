#!/usr/bin/env node

import { writeFileSync } from "node:fs";

const [command, target] = process.argv.slice(2);
const status = process.env.IDEAPROOF_FAKE_OTS_STATUS ?? "pending";

if (command === "stamp" && target) {
  writeFileSync(`${target}.ots`, "deterministic OpenTimestamps fixture\n");
  process.stdout.write("Submitting to remote calendar\n");
  process.exit(0);
}

if (command === "upgrade") {
  process.stdout.write("Proof upgraded\n");
  process.exit(0);
}

if (command === "verify") {
  if (status === "confirmed") {
    process.stdout.write(
      "Success! Bitcoin block 900000 attests existence as of 2026-07-25 UTC\n",
    );
    process.exit(0);
  }
  if (status === "mismatch") {
    process.stderr.write("Digest mismatch\n");
    process.exit(1);
  }
  if (status === "invalid") {
    process.stderr.write("Invalid timestamp proof\n");
    process.exit(1);
  }
  process.stderr.write("Pending confirmation in Bitcoin blockchain\n");
  process.exit(1);
}

process.stderr.write("Unsupported fake ots command\n");
process.exit(2);
