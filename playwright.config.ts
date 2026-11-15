import { defineConfig, devices } from "@playwright/test";

// E2E runs against the PRODUCTION build (`npm run build` first), because
// the strict nonce CSP only applies there — dev mode would hide CSP bugs.
// It uses its own port so it never collides with `npm run dev` (3100).
const PORT = Number(process.env.E2E_PORT ?? 3110);
// Unit tests are pure functions: don't boot (or require) a build for them.
const unitOnly = process.argv.some((a) => a === "--project=unit");

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "unit", testMatch: /unit\/.*\.spec\.ts/ },
    {
      name: "e2e",
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: unitOnly
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
