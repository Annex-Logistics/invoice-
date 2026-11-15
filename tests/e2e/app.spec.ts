import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loadSampleData, trackErrors, waitForSave } from "./helpers";

const ROUTES: Array<[string, string]> = [
  ["/", "Dashboard"],
  ["/invoices", "Invoices"],
  ["/estimates", "Estimates"],
  ["/clients", "Clients"],
  ["/reports", "Reports"],
  ["/settings", "Settings"],
  ["/invoices/new", "New invoice"],
  ["/estimates/new", "New estimate"],
];

for (const [path, heading] of ROUTES) {
  test(`${path} hydrates with no console or CSP errors`, async ({ page }) => {
    const assertNoErrors = trackErrors(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    assertNoErrors();
  });
}

test("production responses carry a nonce CSP and every script has the nonce", async ({ request }) => {
  const res = await request.get("/");
  const csp = res.headers()["content-security-policy"] ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce, "nonce in CSP").toBeTruthy();
  expect(csp).toContain("'strict-dynamic'");
  const html = await res.text();
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  expect(scripts.length).toBeGreaterThan(0);
  for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
});

test("sample data fills the dashboard", async ({ page }) => {
  await loadSampleData(page);
  await expect(page.getByText("$6,250.80")).toBeVisible();
  await expect(page.getByText("$4,749.30")).toBeVisible();
});

test("create an invoice, record a payment, mark it sent", async ({ page }) => {
  const assertNoErrors = trackErrors(page);
  await page.goto("/invoices/new");
  await page.getByPlaceholder("Your business name").fill("Annex Logistics");
  await page.getByPlaceholder("Client / company name").fill("Chukwu Stores");
  await page.getByLabel("Item description").first().fill("Same-day delivery");
  await page.getByLabel("Quantity").first().fill("2");
  await page.getByLabel("Rate").first().fill("150");
  await waitForSave(page);

  await page.getByRole("link", { name: "Back" }).click();
  const row = page.getByRole("row").filter({ hasText: "Chukwu Stores" });
  await expect(row).toContainText("$300.00");

  await row.getByRole("link").click();
  await expect(page.getByLabel("Item description").first()).toHaveValue("Same-day delivery");
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await waitForSave(page);

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("annexinvoice.invoices.v1") ?? "[]")
  );
  expect(stored).toHaveLength(1);
  expect(stored[0].status).toBe("sent");
  expect(stored[0].payments[0].amount).toBe(300);
  expect(stored[0].business.name).toBe("Annex Logistics");
  assertNoErrors();
});

test("Download PDF produces a valid PDF", async ({ page }) => {
  await loadSampleData(page);
  await page.getByText("INV-0003").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).first().click(),
  ]);
  expect(download.suggestedFilename()).toBe("INV-0003.pdf");
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(2000);
});

test("an estimate converts to an invoice and keeps its client", async ({ page }) => {
  await page.goto("/estimates/new");
  await page.getByPlaceholder("Client / company name").fill("Okafor Farms");
  await page.getByLabel("Item description").first().fill("Quarterly haulage");
  await page.getByLabel("Rate").first().fill("500");
  await waitForSave(page);

  await page.goto("/estimates");
  await page.getByRole("row").filter({ hasText: "Okafor Farms" }).getByRole("link").click();
  await page.getByRole("button", { name: "Convert to invoice" }).click();
  await expect(page).toHaveURL(/\/invoices\/[\w-]+$/);
  await expect(page.getByPlaceholder("Client / company name")).toHaveValue("Okafor Farms");

  const counts = await page.evaluate(() => ({
    invoices: JSON.parse(localStorage.getItem("annexinvoice.invoices.v1") ?? "[]").length,
    estimates: JSON.parse(localStorage.getItem("annexinvoice.estimates.v1") ?? "[]").length,
  }));
  expect(counts).toEqual({ invoices: 1, estimates: 1 });
});

test("backup export + import restores payments, estimates and clients", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await loadSampleData(page);
  await page.evaluate(() => {
    const invoices = JSON.parse(localStorage.getItem("annexinvoice.invoices.v1")!);
    invoices[0].payments = [
      { id: "p1", date: "2026-11-01", amount: 100, method: "cash", note: "deposit" },
    ];
    localStorage.setItem("annexinvoice.invoices.v1", JSON.stringify(invoices));
    localStorage.setItem(
      "annexinvoice.clients.v1",
      JSON.stringify([{ id: "c1", name: "Ada Obi", email: "ada@example.com", phone: "", address: "" }])
    );
    localStorage.setItem(
      "annexinvoice.estimates.v1",
      JSON.stringify([{ ...invoices[1], id: "e1", kind: "estimate", number: "EST-0001", status: "accepted" }])
    );
  });
  const before = await page.evaluate(() => ({ ...localStorage }));

  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export backup" }).click(),
  ]);
  const backupPath = await download.path();
  const backup = JSON.parse(await readFile(backupPath, "utf8"));
  expect(backup.estimates).toHaveLength(1);
  expect(backup.clients).toHaveLength(1);

  await page.evaluate(() => localStorage.clear());
  await page.getByLabel("Import backup").setInputFiles(backupPath);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("annexinvoice.clients.v1")))
    .not.toBeNull();

  const after = await page.evaluate(() => ({ ...localStorage }));
  const pick = (s: Record<string, string>, k: string) => JSON.parse(s[`annexinvoice.${k}.v1`]);
  expect(pick(after, "invoices")[0].payments).toEqual(pick(before, "invoices")[0].payments);
  expect(pick(after, "estimates")[0].status).toBe("accepted");
  expect(pick(after, "clients")).toEqual(pick(before, "clients"));
});

test("picking a saved client links the invoice, and the link survives a rename", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "annexinvoice.clients.v1",
      JSON.stringify([{ id: "c1", name: "Ada Obi", email: "ada@example.com", phone: "", address: "" }])
    )
  );
  await page.goto("/invoices/new");
  await page.getByRole("button", { name: "Pick client" }).click();
  await page.getByRole("button", { name: /Ada Obi/ }).click();
  await expect(page.getByPlaceholder("Client / company name")).toHaveValue("Ada Obi");
  await expect(page.getByText("Saved client")).toBeVisible();
  await page.getByLabel("Rate").first().fill("120");
  await waitForSave(page);

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("annexinvoice.invoices.v1") ?? "[]")
  );
  expect(stored[0].clientId).toBe("c1");

  // Rename the client: the card should still count the invoice.
  await page.evaluate(() =>
    localStorage.setItem(
      "annexinvoice.clients.v1",
      JSON.stringify([{ id: "c1", name: "Ada Obi-Nwosu", email: "ada@new.example", phone: "", address: "" }])
    )
  );
  await page.goto("/clients");
  const card = page.locator(".card").filter({ hasText: "Ada Obi-Nwosu" });
  await expect(card).toContainText("Open latest invoice");
});

test("reports filter by period and never mix currencies", async ({ page }) => {
  await loadSampleData(page);
  // Add an NGN invoice: it must not be added into the USD totals.
  await page.evaluate(() => {
    const invoices = JSON.parse(localStorage.getItem("annexinvoice.invoices.v1")!);
    invoices.push({
      ...invoices[0],
      id: "ngn-1",
      number: "INV-0099",
      currency: { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
      items: [{ id: "x", description: "Haulage", quantity: 1, rate: 500000 }],
      taxValue: 0,
      discountValue: 0,
      shipping: 0,
      payments: [],
      amountPaid: 0,
    });
    localStorage.setItem("annexinvoice.invoices.v1", JSON.stringify(invoices));
  });

  await page.goto("/reports");
  await expect(page.getByText("$6,250.80")).toBeVisible();
  await expect(page.getByText("3 invoices in USD")).toBeVisible();

  await page.getByLabel("Currency").selectOption("NGN");
  await expect(page.getByText("1 invoice in NGN")).toBeVisible();
  await expect(page.getByText("₦500,000.00").first()).toBeVisible();

  await page.getByLabel("Currency").selectOption("USD");
  await page.getByLabel("Period").selectOption("custom");
  await page.getByLabel("From", { exact: true }).fill("2000-01-01");
  await page.getByLabel("To", { exact: true }).fill("2000-12-31");
  await expect(page.getByText("0 invoices in USD")).toBeVisible();

  // The dashboard notes that other currencies exist.
  await page.goto("/");
  await expect(page.getByText(/see Reports for other currencies/)).toBeVisible();
});
