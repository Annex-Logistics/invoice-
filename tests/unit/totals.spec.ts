import { test, expect } from "@playwright/test";
import { calcTotals, sumPayments } from "../../lib/totals";
import { makeInvoice } from "./fixtures";

test.describe("calcTotals", () => {
  test("percent discount applies before percent tax, then shipping", () => {
    const t = calcTotals(
      makeInvoice({
        items: [
          { id: "a", description: "A", quantity: 2, rate: 100 },
          { id: "b", description: "B", quantity: 1, rate: 50 },
        ],
        discountMode: "percent",
        discountValue: 10,
        taxMode: "percent",
        taxValue: 7.5,
        shipping: 20,
      })
    );
    expect(t.subtotal).toBe(250);
    expect(t.discount).toBe(25);
    expect(t.tax).toBeCloseTo(16.875);
    expect(t.total).toBeCloseTo(261.875);
  });

  test("fixed discount and fixed tax", () => {
    const t = calcTotals(
      makeInvoice({ discountMode: "fixed", discountValue: 30, taxMode: "fixed", taxValue: 5 })
    );
    expect(t.subtotal).toBe(200);
    expect(t.total).toBe(175);
  });

  test("discount larger than subtotal never goes negative", () => {
    const t = calcTotals(makeInvoice({ discountMode: "fixed", discountValue: 999 }));
    expect(t.total).toBe(0);
  });

  test("balance due subtracts payments and floors at zero", () => {
    const inv = makeInvoice({
      payments: [
        { id: "p1", date: "2026-01-02", amount: 50, method: "cash", note: "" },
        { id: "p2", date: "2026-01-03", amount: 500, method: "card", note: "" },
      ],
    });
    expect(calcTotals(inv).balanceDue).toBe(0);
  });

  test("junk numbers are treated as zero", () => {
    const t = calcTotals(
      makeInvoice({
        items: [{ id: "a", description: "A", quantity: NaN, rate: 10 }],
        shipping: Number("abc"),
      })
    );
    expect(t.total).toBe(0);
  });
});

test.describe("sumPayments", () => {
  test("uses the payments array when present", () => {
    const inv = makeInvoice({
      amountPaid: 999,
      payments: [{ id: "p1", date: "2026-01-02", amount: 40, method: "cash", note: "" }],
    });
    expect(sumPayments(inv)).toBe(40);
  });

  test("falls back to legacy amountPaid", () => {
    expect(sumPayments(makeInvoice({ amountPaid: 75 }))).toBe(75);
  });
});
