import type { Currency, Invoice } from "./types";
import { calcTotals, sumPayments } from "./totals";
import { findCurrency } from "./currencies";

// All dates here are local-calendar ISO strings (yyyy-mm-dd), matching
// todayISO() in lib/storage.ts. String comparison orders them correctly.

export type RangePreset =
  | "30d"
  | "this-month"
  | "3m"
  | "12m"
  | "this-year"
  | "all"
  | "custom";

export const RANGE_PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: "30d", label: "Last 30 days" },
  { value: "this-month", label: "This month" },
  { value: "3m", label: "Last 3 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "this-year", label: "This year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];

export type DateRange = { from: string; to: string }; // inclusive; "" = open

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function resolveRange(preset: RangePreset, today: string, custom?: DateRange): DateRange {
  const t = parseISO(today);
  switch (preset) {
    case "30d":
      return { from: toISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29)), to: today };
    case "this-month":
      return { from: toISO(new Date(t.getFullYear(), t.getMonth(), 1)), to: today };
    case "3m":
      // The current month plus the two before it.
      return { from: toISO(new Date(t.getFullYear(), t.getMonth() - 2, 1)), to: today };
    case "12m":
      return { from: toISO(new Date(t.getFullYear(), t.getMonth() - 11, 1)), to: today };
    case "this-year":
      return { from: `${t.getFullYear()}-01-01`, to: today };
    case "all":
      return { from: "", to: "" };
    case "custom": {
      const from = custom?.from ?? "";
      const to = custom?.to ?? "";
      // Forgive a reversed custom range rather than showing nothing.
      return from && to && from > to ? { from: to, to: from } : { from, to };
    }
  }
}

export function inRange(iso: string, range: DateRange): boolean {
  if (!iso) return !range.from && !range.to;
  if (range.from && iso < range.from) return false;
  if (range.to && iso > range.to) return false;
  return true;
}

// Currencies present across the documents, most-used first. Amounts in
// different currencies must never be summed together.
export function currenciesByUse(docs: Invoice[]): Currency[] {
  const counts = new Map<string, number>();
  for (const d of docs) counts.set(d.currency.code, (counts.get(d.currency.code) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code]) => findCurrency(code));
}

export function filterDocs(docs: Invoice[], range: DateRange, currencyCode: string): Invoice[] {
  return docs.filter((d) => d.currency.code === currencyCode && inRange(d.issueDate, range));
}

export type Summary = { invoiced: number; collected: number; outstanding: number; overdue: number };

export function summarize(docs: Invoice[], today: string): Summary {
  const s: Summary = { invoiced: 0, collected: 0, outstanding: 0, overdue: 0 };
  for (const inv of docs) {
    const t = calcTotals(inv);
    s.invoiced += t.total;
    s.collected += sumPayments(inv);
    if (inv.status !== "paid") {
      s.outstanding += t.balanceDue;
      if (inv.dueDate && inv.dueDate < today) s.overdue += t.balanceDue;
    }
  }
  return s;
}

export type Bucket = { key: string; label: string; invoiced: number; collected: number; count: number };

// Chart buckets covering the range: monthly up to 24 months, yearly
// beyond that so bars stay readable. An open range ("all") spans the
// earliest issue date to today.
export function buildBuckets(docs: Invoice[], range: DateRange, today: string): Bucket[] {
  const dates = docs.map((d) => d.issueDate).filter(Boolean).sort();
  const from = range.from || dates[0] || today;
  const to = range.to || today;
  const start = parseISO(from);
  const end = parseISO(to);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  const yearly = months > 24;

  const buckets: Bucket[] = [];
  if (yearly) {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      buckets.push({ key: String(y), label: String(y), invoiced: 0, collected: 0, count: 0 });
    }
  } else {
    for (let i = 0; i < Math.max(1, months); i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      buckets.push({
        key: toISO(d).slice(0, 7),
        label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        invoiced: 0,
        collected: 0,
        count: 0,
      });
    }
  }

  for (const inv of docs) {
    if (!inv.issueDate) continue;
    const key = yearly ? inv.issueDate.slice(0, 4) : inv.issueDate.slice(0, 7);
    const bucket = buckets.find((b) => b.key === key);
    if (!bucket) continue;
    bucket.invoiced += calcTotals(inv).total;
    bucket.collected += sumPayments(inv);
    bucket.count++;
  }
  return buckets;
}
