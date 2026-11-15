import { test, expect } from "@playwright/test";
import { parseBackup } from "../../lib/import";
import { buildInvoiceMailto } from "../../lib/email";
import { makeInvoice } from "./fixtures";

test.describe("parseBackup", () => {
  test("round-trips invoices with payments, estimates and clients", () => {
    const invoice = makeInvoice({
      status: "paid",
      payments: [{ id: "p1", date: "2026-01-05", amount: 200, method: "bank-transfer", note: "Ref 123" }],
    });
    const estimate = makeInvoice({ id: "est-1", kind: "estimate", number: "EST-0001", status: "accepted" });
    const client = { id: "c1", name: "Ada Obi", email: "ada@example.com", phone: "080", address: "Lagos" };

    const result = parseBackup(
      JSON.stringify({ invoices: [invoice], estimates: [estimate], clients: [client] })
    );

    expect(result.warnings).toEqual([]);
    expect(result.invoices?.[0].payments).toEqual(invoice.payments);
    expect(result.invoices?.[0].status).toBe("paid");
    expect(result.invoices?.[0].kind).toBe("invoice");
    expect(result.estimates?.[0].kind).toBe("estimate");
    expect(result.estimates?.[0].status).toBe("accepted");
    expect(result.clients).toEqual([client]);
  });

  test("an estimate status is not valid on an invoice", () => {
    const result = parseBackup(JSON.stringify({ invoices: [makeInvoice({ status: "accepted" })] }));
    expect(result.invoices?.[0].status).toBe("draft");
  });

  test("drops prototype-pollution keys", () => {
    const result = parseBackup(
      '{"__proto__": {"polluted": true}, "business": {"name": "X", "__proto__": {"bad": 1}}}'
    );
    expect(result.business?.name).toBe("X");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test("rejects a non-image logo data URL", () => {
    const result = parseBackup(
      JSON.stringify({ business: { name: "X", logoDataUrl: "data:text/html;base64,PHNjcmlwdD4=" } })
    );
    expect(result.business?.logoDataUrl).toBeUndefined();
  });

  test("skips invalid payments and reports invalid records", () => {
    const result = parseBackup(
      JSON.stringify({
        invoices: [
          makeInvoice({
            payments: [
              { id: "ok", date: "2026-01-05", amount: 10, method: "cash", note: "" },
              { id: "bad-date", date: "yesterday", amount: 10, method: "cash", note: "" },
              { id: "neg", date: "2026-01-05", amount: -5, method: "cash", note: "" },
            ],
          }),
          { number: "no id" },
        ],
        clients: [{ id: "empty" }],
      })
    );
    expect(result.invoices?.[0].payments?.map((p) => p.id)).toEqual(["ok"]);
    expect(result.warnings).toContain("Skipped 1 invalid invoice(s).");
    expect(result.warnings).toContain("Skipped 1 invalid client(s).");
  });

  test("throws on non-JSON and on empty backups", () => {
    expect(() => parseBackup("not json")).toThrow(/valid JSON/);
    expect(() => parseBackup("{}")).toThrow(/empty/);
  });
});

test.describe("buildInvoiceMailto", () => {
  test("strips header-injection characters from the address", () => {
    const href = buildInvoiceMailto(
      makeInvoice({ billTo: { name: "A", email: "a@x.com\r\nbcc:evil@x.com", phone: "", address: "" } })
    );
    expect(href.startsWith("mailto:a@x.combcc:evil@x.com?")).toBe(true);
    expect(href).not.toMatch(/[\r\n]/);
  });

  test("reports recorded payments, not just the legacy field", () => {
    const href = buildInvoiceMailto(
      makeInvoice({ payments: [{ id: "p1", date: "2026-01-05", amount: 50, method: "cash", note: "" }] })
    );
    const body = decodeURIComponent(href.split("body=")[1]);
    expect(body).toContain("Amount paid: $50.00");
    expect(body).toContain("Balance due: $150.00");
  });
});

test.describe("multi-business backups", () => {
  test("businesses, the active one and document owners round-trip", () => {
    const profile = (id: string, name: string) => ({
      id,
      business: { name, email: "", phone: "", address: "", website: "" },
      prefs: {
        numberPrefix: id === "b2" ? "AR-" : "INV-",
        nextNumber: 5,
        numberPadding: 4,
        defaultTerms: "t",
        defaultTaxLabel: "VAT",
        defaultTaxPercent: 7.5,
        defaultCurrencyCode: "NGN",
        defaultDueDays: 7,
      },
      counter: 4,
      estimateCounter: 1,
    });
    const result = parseBackup(
      JSON.stringify({
        businesses: [profile("b1", "Annex Logistics"), profile("b2", "Annex Rides"), { name: "no id" }],
        currentBusinessId: "b2",
        invoices: [makeInvoice({ businessId: "b2" })],
      })
    );
    expect(result.businesses?.map((b) => b.business.name)).toEqual(["Annex Logistics", "Annex Rides"]);
    expect(result.businesses?.[1].prefs.numberPrefix).toBe("AR-");
    expect(result.businesses?.[1].counter).toBe(4);
    expect(result.currentBusinessId).toBe("b2");
    expect(result.invoices?.[0].businessId).toBe("b2");
    expect(result.warnings).toContain("Skipped 1 invalid business(es).");
  });

  test("an unknown currentBusinessId is dropped", () => {
    const result = parseBackup(
      JSON.stringify({ businesses: [{ id: "b1", business: { name: "X" } }], currentBusinessId: "nope" })
    );
    expect(result.currentBusinessId).toBeUndefined();
  });
});
