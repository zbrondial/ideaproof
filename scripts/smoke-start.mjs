import { spawn } from "node:child_process";

const port = process.env.IDEAPROOF_SMOKE_PORT ?? "3000";
const url = `http://127.0.0.1:${port}`;
const smokeEnv = {
  ...process.env,
  OPENAI_API_KEY:
    process.env.OPENAI_API_KEY?.trim() || "smoke-fixture-key",
  IDEAPROOF_DATA_DIR:
    process.env.IDEAPROOF_DATA_DIR ?? "./data",
};
const child = spawn("npm", ["start", "--", "--port", port], {
  cwd: process.cwd(),
  env: smokeEnv,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});

const deadline = Date.now() + 30_000;
let status = 1;

try {
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`IdeaProof exited before responding.\n${output}`);
    }
    try {
      const [home, setup] = await Promise.all([
        fetch(url),
        fetch(`${url}/api/setup`),
      ]);
      if (home.status === 200 && setup.status === 200) {
        process.stdout.write("IdeaProof home and setup checks responded with 200\n");
        status = 0;
        break;
      }
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (status !== 0) {
    throw new Error(`IdeaProof did not respond within 30 seconds.\n${output}`);
  }
} finally {
  child.kill("SIGTERM");
}

process.exit(status);
