import { expect, type Page } from "@playwright/test";

// Collect console errors and uncaught exceptions for the whole test.
// A CSP violation shows up here as a console error, which is exactly
// the production bug class we want CI to catch.
export function trackErrors(page: Page): () => void {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return () => expect(errors, "console errors").toEqual([]);
}

// Wait for the debounced auto-save to land in localStorage.
export async function waitForSave(page: Page) {
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}

export async function loadSampleData(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await expect(page.getByText("INV-0003")).toBeVisible();
}
