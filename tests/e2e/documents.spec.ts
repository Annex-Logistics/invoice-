import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loadSampleData, trackErrors, waitForSave } from "./helpers";

for (const [path, heading] of [
  ["/receipts", "Receipts"],
  ["/delivery-notes", "Delivery notes"],
  ["/receipts/new", "New receipt"],
  ["/delivery-notes/new", "New delivery note"],
] as const) {
  test(`${path} hydrates with no console or CSP errors`, async ({ page }) => {
    const assertNoErrors = trackErrors(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    assertNoErrors();
  });
}

test("a receipt created from an invoice carries its payments", async ({ page }) => {
  await loadSampleData(page);
  await page.getByText("INV-0003").click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await waitForSave(page);
  await page.getByRole("button", { name: "Create receipt" }).click();

  await expect(page).toHaveURL(/\/receipts\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("REC-0001");
  await expect(page.getByText("For invoice INV-0003")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Received From" })).toBeVisible();
  // Receipts have a single date and no invoice-only actions.
  await expect(page.getByText("Due", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark as sent" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Repeat", exact: true })).toHaveCount(0);

  const receipt = await page.evaluate(
    () => JSON.parse(localStorage.getItem("annexinvoice.receipts.v1")!)[0]
  );
  expect(receipt).toMatchObject({ kind: "receipt", status: "issued", sourceNumber: "INV-0003" });
  expect(receipt.payments).toHaveLength(1);
  expect(receipt.payments[0].amount).toBe(2574);

  // The receipt is listed with its source invoice.
  await page.goto("/receipts");
  const row = page.getByRole("row").filter({ hasText: "REC-0001" });
  await expect(row).toContainText("INV-0003");
  await expect(row).toContainText("Issued");
  await expect(row).toContainText("$2,574.00");
});

test("a delivery note shows quantities but no prices, with signature lines", async ({ page }) => {
  const assertNoErrors = trackErrors(page);
  await loadSampleData(page);
  await page.getByText("INV-0001").click();
  await page.getByRole("button", { name: "Create delivery note" }).click();

  await expect(page).toHaveURL(/\/delivery-notes\/[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("DN-0001");
  await expect(page.getByRole("heading", { name: "Deliver To" })).toBeVisible();
  await expect(page.getByLabel("Quantity").first()).toBeVisible();
  await expect(page.getByLabel("Rate")).toHaveCount(0);
  await expect(page.getByText("Subtotal")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0);

  await page.getByRole("button", { name: "Preview" }).first().click();
  const paper = page.locator(".paper");
  await expect(paper).toContainText("DELIVERY NOTE");
  await expect(paper).toContainText("Received by (name and signature)");
  await expect(paper).not.toContainText("$");
  await page.getByRole("button", { name: "Close" }).first().click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).first().click(),
  ]);
  expect(download.suggestedFilename()).toBe("DN-0001.pdf");
  const pdf = (await readFile(await download.path())).toString("latin1");
  expect(pdf.startsWith("%PDF-")).toBe(true);

  // Status options are the delivery note's own.
  await page.getByRole("button", { name: "delivered" }).click();
  await waitForSave(page);
  const note = await page.evaluate(
    () => JSON.parse(localStorage.getItem("annexinvoice.deliveryNotes.v1")!)[0]
  );
  expect(note.status).toBe("delivered");
  expect(note.payments).toEqual([]);
  assertNoErrors();
});

test("blank receipts and delivery notes number independently per type", async ({ page }) => {
  await page.goto("/receipts/new");
  await page.getByPlaceholder("Client / company name").fill("Walk-in customer");
  await waitForSave(page);
  await page.goto("/receipts/new");
  await page.getByPlaceholder("Client / company name").fill("Second customer");
  await waitForSave(page);
  await page.goto("/delivery-notes/new");
  await page.getByPlaceholder("Client / company name").fill("Depot");
  await waitForSave(page);
  const numbers = await page.evaluate(() => ({
    receipts: JSON.parse(localStorage.getItem("annexinvoice.receipts.v1")!).map(
      (d: { number: string }) => d.number
    ),
    notes: JSON.parse(localStorage.getItem("annexinvoice.deliveryNotes.v1")!).map(
      (d: { number: string }) => d.number
    ),
    invoices: JSON.parse(localStorage.getItem("annexinvoice.invoices.v1") ?? "[]"),
  }));
  expect(numbers.receipts.sort()).toEqual(["REC-0001", "REC-0002"]);
  expect(numbers.notes).toEqual(["DN-0001"]);
  expect(numbers.invoices).toEqual([]); // no invoice numbers were used up
});

test("status and duplicate controls are reachable on a phone", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await loadSampleData(page);
  await page.getByText("INV-0003").click();
  await expect(page.getByRole("button", { name: "paid", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Duplicate/ })).toBeVisible();

  // The More menu reaches the pages that are not in the bottom bar.
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Delivery notes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Delivery notes" })).toBeVisible();
  await ctx.close();
});
