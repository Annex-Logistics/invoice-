import { test, expect } from "@playwright/test";
import { loadSampleData, trackErrors } from "./helpers";

const isDark = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

test("follows the system theme by default, before first paint", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  const assertNoErrors = trackErrors(page);
  await page.goto("/");
  // Applied by the blocking head script, so it's already there at DOMContentLoaded.
  expect(await isDark(page)).toBe(true);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(12, 15, 21)");
  assertNoErrors(); // the theme script must pass the nonce CSP
  await ctx.close();
});

test("the Settings choice overrides the system and persists", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  await page.getByRole("radio", { name: "dark" }).click();
  expect(await isDark(page)).toBe(true);
  await page.reload();
  expect(await isDark(page)).toBe(true);
  await page.getByRole("radio", { name: "light" }).click();
  expect(await isDark(page)).toBe(false);
});

test("invoice paper and primary buttons stay readable in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await loadSampleData(page);
  await page.getByText("INV-0003").click();
  const btn = page.getByRole("button", { name: "Mark as sent" });
  await expect(btn).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Preview" }).first().click();
  const paper = page.locator(".paper");
  await expect(paper).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(paper).toHaveCSS("color", "rgb(31, 35, 44)");
});
