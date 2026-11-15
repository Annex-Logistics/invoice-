import type { Business, Invoice, InvoicePrefs, SavedItem } from "./types";
import { defaultPrefs, emptyBusiness } from "./storage";
import { findCurrency } from "./currencies";

// A deliberately conservative parser for backup JSON. Everything is
// coerced to the expected shape and length, and any `__proto__` /
// `constructor` keys an attacker could sneak into the JSON are
// dropped. Fields that fail validation fall back to safe defaults
// rather than throwing, so a partially-corrupt backup still restores
// what it can.

export type BackupParseResult = {
  business?: Business;
  prefs?: InvoicePrefs;
  items?: SavedItem[];
  invoices?: Invoice[];
  warnings: string[];
};

const MAX_STR = 2000;
const MAX_LONG_STR = 20000; // notes, terms, address
const MAX_LOGO = 2 * 1024 * 1024; // 2 MB base64 data URL
const MAX_ITEMS = 500;
const MAX_INVOICES = 5000;

function clean(s: unknown, max = MAX_STR): string {
  if (typeof s !== "string") return "";
  // Strip unprintable control chars (except tab/newline) and clip length.
  return s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").slice(0, max);
}

function num(n: unknown, fallback = 0): number {
  const v = typeof n === "number" ? n : parseFloat(String(n));
  return Number.isFinite(v) ? v : fallback;
}

function strip(obj: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    out[k] = v;
  }
  return out;
}

function parseBusiness(raw: unknown): Business {
  const o = strip(raw);
  const biz: Business = {
    ...emptyBusiness(),
    name: clean(o.name),
    email: clean(o.email, 320),
    phone: clean(o.phone, 64),
    address: clean(o.address, MAX_LONG_STR),
    website: clean(o.website),
  };
  if (typeof o.logoDataUrl === "string") {
    const url = o.logoDataUrl;
    if (
      url.length <= MAX_LOGO &&
      /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(url)
    ) {
      biz.logoDataUrl = url;
    }
  }
  return biz;
}

function parsePrefs(raw: unknown): InvoicePrefs {
  const o = strip(raw);
  const base = defaultPrefs();
  return {
    numberPrefix: clean(o.numberPrefix, 32) || base.numberPrefix,
    nextNumber: Math.max(1, Math.floor(num(o.nextNumber, base.nextNumber))),
    numberPadding: Math.min(10, Math.max(1, Math.floor(num(o.numberPadding, base.numberPadding)))),
    defaultTerms: clean(o.defaultTerms, MAX_LONG_STR) || base.defaultTerms,
    defaultTaxLabel: clean(o.defaultTaxLabel, 40) || base.defaultTaxLabel,
    defaultTaxPercent: Math.max(0, num(o.defaultTaxPercent, base.defaultTaxPercent)),
    defaultCurrencyCode: clean(o.defaultCurrencyCode, 8) || base.defaultCurrencyCode,
    defaultDueDays: Math.max(0, Math.floor(num(o.defaultDueDays, base.defaultDueDays))),
  };
}

function parseItem(raw: unknown): SavedItem | null {
  const o = strip(raw);
  const description = clean(o.description, 500);
  if (!description) return null;
  return {
    id: clean(o.id, 64) || crypto.randomUUID(),
    description,
    rate: num(o.rate),
  };
}

function parseInvoice(raw: unknown): Invoice | null {
  const o = strip(raw);
  const id = clean(o.id, 64);
  if (!id) return null;

  const items = Array.isArray(o.items)
    ? o.items
        .slice(0, 500)
        .map((it) => {
          const s = strip(it);
          return {
            id: clean(s.id, 64) || crypto.randomUUID(),
            description: clean(s.description, 500),
            quantity: num(s.quantity, 1),
            rate: num(s.rate),
          };
        })
    : [];

  const currency = findCurrency(clean(strip(o.currency).code, 8));
  const status = (["draft", "sent", "paid", "overdue"] as const).includes(
    (o.status as never) ?? "draft"
  )
    ? (o.status as Invoice["status"])
    : "draft";
  const discountMode = (o.discountMode === "fixed" ? "fixed" : "percent") as Invoice["discountMode"];
  const taxMode = (o.taxMode === "fixed" ? "fixed" : "percent") as Invoice["taxMode"];

  const party = (p: unknown) => {
    const s = strip(p);
    return {
      name: clean(s.name),
      email: clean(s.email, 320),
      address: clean(s.address, MAX_LONG_STR),
      phone: clean(s.phone, 64),
    };
  };

  const dateLike = /^\d{4}-\d{2}-\d{2}$/;
  const issueDate = typeof o.issueDate === "string" && dateLike.test(o.issueDate) ? o.issueDate : "";
  const dueDate = typeof o.dueDate === "string" && dateLike.test(o.dueDate) ? o.dueDate : "";

  return {
    id,
    number: clean(o.number, 64),
    status,
    createdAt: clean(o.createdAt, 64) || new Date().toISOString(),
    updatedAt: clean(o.updatedAt, 64) || new Date().toISOString(),
    issueDate,
    dueDate,
    poNumber: clean(o.poNumber, 64),
    business: parseBusiness(o.business),
    billTo: party(o.billTo),
    shipTo: party(o.shipTo),
    items: items.length ? items : [{ id: crypto.randomUUID(), description: "", quantity: 1, rate: 0 }],
    currency,
    taxLabel: clean(o.taxLabel, 40) || "Tax",
    taxMode,
    taxValue: Math.max(0, num(o.taxValue)),
    discountLabel: clean(o.discountLabel, 40) || "Discount",
    discountMode,
    discountValue: Math.max(0, num(o.discountValue)),
    shipping: Math.max(0, num(o.shipping)),
    notes: clean(o.notes, MAX_LONG_STR),
    terms: clean(o.terms, MAX_LONG_STR),
    amountPaid: Math.max(0, num(o.amountPaid)),
  };
}

export function parseBackup(text: string): BackupParseResult {
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The file isn't valid JSON.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("The file doesn't look like an AnnexInvoice backup.");
  }
  const d = strip(data);

  const result: BackupParseResult = { warnings };

  if (d.business) result.business = parseBusiness(d.business);
  if (d.prefs) result.prefs = parsePrefs(d.prefs);

  if (Array.isArray(d.items)) {
    const parsed = d.items.slice(0, MAX_ITEMS).map(parseItem).filter(Boolean) as SavedItem[];
    if (parsed.length !== d.items.length) {
      warnings.push(`Skipped ${d.items.length - parsed.length} invalid library item(s).`);
    }
    result.items = parsed;
  }

  if (Array.isArray(d.invoices)) {
    const parsed = d.invoices
      .slice(0, MAX_INVOICES)
      .map(parseInvoice)
      .filter(Boolean) as Invoice[];
    if (parsed.length !== d.invoices.length) {
      warnings.push(`Skipped ${d.invoices.length - parsed.length} invalid invoice(s).`);
    }
    result.invoices = parsed;
  }

  if (!result.business && !result.prefs && !result.items && !result.invoices) {
    throw new Error("Backup is empty or doesn't contain any known data.");
  }

  return result;
}
