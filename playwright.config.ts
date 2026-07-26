import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: {
      ...process.env,
      IDEAPROOF_DATA_DIR: "./test-results/e2e-data",
      IDEAPROOF_E2E_FIXTURES: "1",
      OPENAI_API_KEY: "e2e-fixture-key",
      ANTHROPIC_API_KEY: "e2e-fixture-key",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
