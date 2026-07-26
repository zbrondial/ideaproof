import { spawn } from "node:child_process";

const url = "http://127.0.0.1:3000";
const child = spawn("npm", ["start"], {
  cwd: process.cwd(),
  env: process.env,
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
      const response = await fetch(url);
      if (response.status === 200) {
        process.stdout.write("IdeaProof responded with 200\n");
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
