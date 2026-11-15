import { test, expect, type Browser } from "@playwright/test";

// Calendar dates must follow the user's local day, not UTC. These pin
// the clock to moments where the two disagree.

async function at(browser: Browser, timezoneId: string, utc: string) {
  const ctx = await browser.newContext({ timezoneId });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(utc));
  return { ctx, page };
}

const invoice = (over: Record<string, unknown>) => ({
  id: "tz-1",
  kind: "invoice",
  number: "INV-0001",
  status: "sent",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  issueDate: "2026-11-01",
  dueDate: "2026-11-15",
  business: { name: "Annex Logistics", email: "", phone: "", address: "", website: "" },
  billTo: { name: "Ada Obi", email: "", phone: "", address: "" },
  items: [{ id: "l1", description: "Delivery", quantity: 1, rate: 1000 }],
  currency: { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  taxLabel: "Tax",
  taxMode: "percent",
  taxValue: 0,
  discountLabel: "Discount",
  discountMode: "percent",
  discountValue: 0,
  shipping: 0,
  notes: "",
  terms: "",
  amountPaid: 0,
  payments: [],
  ...over,
});

test("Lagos, 00:30 on the 16th (UTC is still the 15th): new invoice is dated the 16th", async ({ browser }) => {
  const { ctx, page } = await at(browser, "Africa/Lagos", "2026-11-15T23:30:00Z");
  await page.goto("/invoices/new");
  const dates = page.locator('input[type="date"]');
  await expect(dates.nth(0)).toHaveValue("2026-11-16");
  await expect(dates.nth(1)).toHaveValue("2026-11-30"); // +14 days
  await ctx.close();
});

test("Los Angeles, 23:30 on the 14th (UTC is already the 15th): new invoice is dated the 14th", async ({ browser }) => {
  const { ctx, page } = await at(browser, "America/Los_Angeles", "2026-11-15T07:30:00Z");
  await page.goto("/invoices/new");
  await expect(page.locator('input[type="date"]').nth(0)).toHaveValue("2026-11-14");
  await ctx.close();
});

test("an invoice becomes overdue the local day after its due date, not before", async ({ browser }) => {
  // Due the 15th. In Lagos it is already the 16th: overdue.
  const lagos = await at(browser, "Africa/Lagos", "2026-11-15T23:30:00Z");
  await lagos.page.goto("/");
  await lagos.page.evaluate((inv) => localStorage.setItem("annexinvoice.invoices.v1", JSON.stringify([inv])), invoice({}));
  await lagos.page.reload();
  const overdueTile = (p: typeof lagos.page) => p.locator(".card").filter({ hasText: /^Overdue/i });
  await expect(overdueTile(lagos.page)).toContainText("1");
  await lagos.ctx.close();

  // Same instant in Los Angeles: still the 15th, the due date itself. Not overdue.
  const la = await at(browser, "America/Los_Angeles", "2026-11-15T23:30:00Z");
  await la.page.goto("/");
  await la.page.evaluate((inv) => localStorage.setItem("annexinvoice.invoices.v1", JSON.stringify([inv])), invoice({}));
  await la.page.reload();
  await expect(overdueTile(la.page)).toContainText("0");
  await la.ctx.close();
});

test("a recurring invoice due on the local date runs even while UTC is a day behind", async ({ browser }) => {
  const { ctx, page } = await at(browser, "Africa/Lagos", "2026-11-15T23:30:00Z");
  await page.goto("/");
  await page.evaluate(
    ([inv, schedule]) => {
      localStorage.setItem("annexinvoice.invoices.v1", JSON.stringify([inv]));
      localStorage.setItem("annexinvoice.recurring.v1", JSON.stringify([schedule]));
    },
    [
      invoice({}),
      {
        id: "s1",
        sourceInvoiceId: "tz-1",
        frequency: "monthly",
        startDate: "2026-11-16",
        runCount: 0,
        active: true,
        createdAt: "2026-11-01T00:00:00.000Z",
      },
    ]
  );
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Created 1 recurring invoice");
  const made = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("annexinvoice.invoices.v1")!).find(
      (i: { recurringId?: string }) => i.recurringId === "s1"
    )
  );
  expect(made.issueDate).toBe("2026-11-16");
  expect(made.dueDate).toBe("2026-11-30"); // same 14-day terms as the source
  await ctx.close();
});

test("reports' This month follows the local month at a month boundary", async ({ browser }) => {
  // Lagos: 00:30 on 1 Dec. UTC: 23:30 on 30 Nov.
  const { ctx, page } = await at(browser, "Africa/Lagos", "2026-11-30T23:30:00Z");
  await page.goto("/");
  await page.evaluate(
    (list) => localStorage.setItem("annexinvoice.invoices.v1", JSON.stringify(list)),
    [
      invoice({ id: "nov", number: "INV-0001", issueDate: "2026-11-30" }),
      invoice({ id: "dec", number: "INV-0002", issueDate: "2026-12-01" }),
    ]
  );
  await page.goto("/reports");
  await page.getByLabel("Period").selectOption("this-month");
  await expect(page.getByText("1 invoice in NGN")).toBeVisible();
  await ctx.close();
});
