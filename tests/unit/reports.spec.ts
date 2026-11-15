import { test, expect } from "@playwright/test";
import {
  buildBuckets,
  currenciesByUse,
  filterDocs,
  inRange,
  resolveRange,
  summarize,
} from "../../lib/reports";
import { findCurrency } from "../../lib/currencies";
import { makeInvoice } from "./fixtures";

const TODAY = "2026-11-15";
const NGN = findCurrency("NGN");

test.describe("resolveRange", () => {
  test("presets resolve against the local calendar", () => {
    expect(resolveRange("30d", TODAY)).toEqual({ from: "2026-10-17", to: TODAY });
    expect(resolveRange("this-month", TODAY)).toEqual({ from: "2026-11-01", to: TODAY });
    expect(resolveRange("3m", TODAY)).toEqual({ from: "2026-09-01", to: TODAY });
    expect(resolveRange("12m", TODAY)).toEqual({ from: "2025-12-01", to: TODAY });
    expect(resolveRange("this-year", TODAY)).toEqual({ from: "2026-01-01", to: TODAY });
    expect(resolveRange("all", TODAY)).toEqual({ from: "", to: "" });
  });

  test("month arithmetic crosses year boundaries", () => {
    expect(resolveRange("3m", "2026-01-31")).toEqual({ from: "2025-11-01", to: "2026-01-31" });
    expect(resolveRange("30d", "2026-03-01")).toEqual({ from: "2026-01-31", to: "2026-03-01" });
  });

  test("a reversed custom range is swapped, open ends stay open", () => {
    expect(resolveRange("custom", TODAY, { from: "2026-05-01", to: "2026-02-01" })).toEqual({
      from: "2026-02-01",
      to: "2026-05-01",
    });
    expect(resolveRange("custom", TODAY, { from: "2026-02-01", to: "" })).toEqual({
      from: "2026-02-01",
      to: "",
    });
  });

  test("inRange is inclusive on both ends", () => {
    const r = { from: "2026-02-01", to: "2026-02-28" };
    expect(inRange("2026-02-01", r)).toBe(true);
    expect(inRange("2026-02-28", r)).toBe(true);
    expect(inRange("2026-03-01", r)).toBe(false);
  });
});

test.describe("currencies and summaries", () => {
  const docs = [
    makeInvoice({ id: "a", currency: NGN, issueDate: "2026-11-02" }),
    makeInvoice({ id: "b", currency: NGN, issueDate: "2026-06-10" }),
    makeInvoice({ id: "c", issueDate: "2026-11-03" }), // USD
  ];

  test("most-used currency first", () => {
    expect(currenciesByUse(docs).map((c) => c.code)).toEqual(["NGN", "USD"]);
  });

  test("filtering never mixes currencies", () => {
    const r = resolveRange("this-month", TODAY);
    expect(filterDocs(docs, r, "NGN").map((d) => d.id)).toEqual(["a"]);
    expect(filterDocs(docs, r, "USD").map((d) => d.id)).toEqual(["c"]);
  });

  test("summarize counts recorded payments and overdue balances", () => {
    const s = summarize(
      [
        makeInvoice({
          dueDate: "2026-11-01",
          status: "sent",
          payments: [{ id: "p", date: "2026-11-02", amount: 50, method: "cash", note: "" }],
        }),
        makeInvoice({ status: "paid", amountPaid: 200 }),
      ],
      TODAY
    );
    expect(s).toEqual({ invoiced: 400, collected: 250, outstanding: 150, overdue: 150 });
  });
});

test.describe("buildBuckets", () => {
  test("monthly buckets span the range", () => {
    const b = buildBuckets(
      [makeInvoice({ issueDate: "2026-10-05" })],
      resolveRange("3m", TODAY),
      TODAY
    );
    expect(b.map((x) => x.key)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(b[1].invoiced).toBe(200);
  });

  test("ranges over 24 months switch to yearly buckets", () => {
    const b = buildBuckets(
      [makeInvoice({ issueDate: "2023-04-01" }), makeInvoice({ issueDate: "2026-01-01" })],
      { from: "", to: "" },
      TODAY
    );
    expect(b.map((x) => x.key)).toEqual(["2023", "2024", "2025", "2026"]);
    expect(b[0].count).toBe(1);
  });
});
