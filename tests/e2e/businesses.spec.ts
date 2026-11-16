import { test, expect } from "@playwright/test";
import { loadSampleData, trackErrors, waitForSave } from "./helpers";

test("existing single-business data migrates into the first business", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "annexinvoice.business.v1",
      JSON.stringify({ name: "Annex Logistics", email: "", phone: "", address: "", website: "" })
    );
  });
  await loadSampleData(page); // writes invoices, then we strip businessId to fake old data
  await page.evaluate(() => {
    const inv = JSON.parse(localStorage.getItem("annexinvoice.invoices.v1")!);
    localStorage.setItem(
      "annexinvoice.invoices.v1",
      JSON.stringify(
        inv.map((i: Record<string, unknown>) => {
          delete i.businessId;
          return i;
        })
      )
    );
    localStorage.removeItem("annexinvoice.businesses.v1");
    localStorage.removeItem("annexinvoice.currentBusiness.v1");
  });
  await page.reload();
  await expect(page.getByText("$6,250.80")).toBeVisible();
  const state = await page.evaluate(() => ({
    profiles: JSON.parse(localStorage.getItem("annexinvoice.businesses.v1")!),
    current: localStorage.getItem("annexinvoice.currentBusiness.v1"),
    owners: JSON.parse(localStorage.getItem("annexinvoice.invoices.v1")!).map(
      (i: { businessId?: string }) => i.businessId
    ),
  }));
  expect(state.profiles).toHaveLength(1);
  expect(state.profiles[0].business.name).toBe("Annex Logistics");
  expect(state.owners.every((o: string) => o === state.current)).toBe(true);
});

test("businesses keep separate documents and numbering", async ({ page }) => {
  const assertNoErrors = trackErrors(page);
  await loadSampleData(page);

  page.once("dialog", (d) => d.accept("Annex Rides"));
  await page.getByRole("button", { name: /Switch business/ }).first().click();
  await page.getByRole("menuitem", { name: "Add business" }).click();

  // The new business starts empty, with its own sequence.
  await expect(page.getByRole("button", { name: /Business: Annex Rides/ }).first()).toBeVisible();
  await expect(page.getByText("No invoices yet")).toBeVisible();
  await page.goto("/invoices/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/New invoice/);
  await page.getByPlaceholder("Client / company name").fill("Rider Co-op");
  await waitForSave(page);
  const riders = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("annexinvoice.invoices.v1")!).filter(
      (i: { billTo: { name: string } }) => i.billTo.name === "Rider Co-op"
    )
  );
  expect(riders[0].number).toBe("INV-0001");

  await page.goto("/invoices");
  await expect(page.getByRole("row")).toHaveCount(2); // header + Rider Co-op

  // Switch back: the sample invoices are there, the new one isn't.
  await page.getByRole("button", { name: /Switch business/ }).first().click();
  await page.getByRole("menuitemradio", { name: /Harbor|Annex|Business/ }).first().click();
  await expect(page.getByText("INV-0003")).toBeVisible();
  await expect(page.getByText("Rider Co-op")).toHaveCount(0);

  // A business with documents can't be deleted.
  await page.goto("/settings");
  const row = page.locator("#businesses li").filter({ hasText: "Annex Rides" });
  await expect(row).toContainText("1 document");
  await expect(row.getByRole("button", { name: /Delete/ })).toBeDisabled();
  assertNoErrors();
});

test("a full backup restores every business", async ({ page }) => {
  page.on("dialog", (d) => d.accept("Second Biz"));
  await loadSampleData(page);
  await page.getByRole("button", { name: /Switch business/ }).first().click();
  await page.getByRole("menuitem", { name: "Add business" }).click();
  await expect(page.getByRole("button", { name: /Business: Second Biz/ }).first()).toBeVisible();

  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export backup" }).click(),
  ]);
  const path = await download.path();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("Import backup").setInputFiles(path);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("annexinvoice.businesses.v1") ?? "[]").length)
    )
    .toBe(2);
  const current = await page.evaluate(() => {
    const id = localStorage.getItem("annexinvoice.currentBusiness.v1");
    const p = JSON.parse(localStorage.getItem("annexinvoice.businesses.v1")!);
    return p.find((x: { id: string }) => x.id === id).business.name;
  });
  expect(current).toBe("Second Biz");
});

test("the switcher shows a business's new name straight away", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Business: Untitled business/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Load sample data" }).click();
  await expect(page.getByRole("button", { name: /Business: Annex Logistics/ }).first()).toBeVisible();
});
