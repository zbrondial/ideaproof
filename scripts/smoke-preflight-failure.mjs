import { spawn } from "node:child_process";

const port = process.env.IDEAPROOF_PREFLIGHT_SMOKE_PORT ?? "3199";
const child = spawn("npm", ["start", "--", "--port", port], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    IDEAPROOF_DATA_DIR:
      process.env.IDEAPROOF_DATA_DIR ?? "./data",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});

const deadline = Date.now() + 15_000;
while (child.exitCode === null && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}

if (child.exitCode === null) {
  child.kill("SIGTERM");
  throw new Error("IdeaProof started despite missing provider keys.");
}
if (!output.includes("STARTUP_PROVIDER_MISSING")) {
  throw new Error(`Expected the provider preflight failure.\n${output}`);
}
if (output.includes("next start")) {
  throw new Error(`Next.js started after a failed preflight.\n${output}`);
}

process.stdout.write(
  "IdeaProof stopped before Next.js when provider configuration was missing\n",
);
