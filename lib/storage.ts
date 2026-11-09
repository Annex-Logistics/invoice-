"use client";

import type { Business, Invoice, InvoicePrefs, SavedItem } from "./types";
import { DEFAULT_CURRENCY, findCurrency } from "./currencies";

const INVOICES_KEY = "annexinvoice.invoices.v1";
const BUSINESS_KEY = "annexinvoice.business.v1";
const COUNTER_KEY  = "annexinvoice.counter.v1";
const PREFS_KEY    = "annexinvoice.prefs.v1";
const ITEMS_KEY    = "annexinvoice.items.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadInvoices(): Invoice[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(INVOICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveInvoices(list: Invoice[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(INVOICES_KEY, JSON.stringify(list));
}

export function loadInvoice(id: string): Invoice | null {
  return loadInvoices().find((inv) => inv.id === id) ?? null;
}

export function upsertInvoice(invoice: Invoice) {
  const list = loadInvoices();
  const idx = list.findIndex((i) => i.id === invoice.id);
  const next: Invoice = { ...invoice, updatedAt: new Date().toISOString() };
  if (idx === -1) list.unshift(next);
  else list[idx] = next;
  saveInvoices(list);
}

export function removeInvoice(id: string) {
  saveInvoices(loadInvoices().filter((i) => i.id !== id));
}

export function duplicateInvoice(id: string): Invoice | null {
  const source = loadInvoice(id);
  if (!source) return null;
  const clone: Invoice = {
    ...source,
    id: createId(),
    number: isBrowser() ? nextInvoiceNumber() : source.number + "-copy",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issueDate: todayISO(),
    dueDate: addDaysISO(todayISO(), 14),
    amountPaid: 0,
    items: source.items.map((item) => ({ ...item, id: createId() })),
  };
  upsertInvoice(clone);
  return clone;
}

export function loadBusiness(): Business {
  if (!isBrowser()) return emptyBusiness();
  try {
    const raw = window.localStorage.getItem(BUSINESS_KEY);
    if (!raw) return emptyBusiness();
    return { ...emptyBusiness(), ...JSON.parse(raw) };
  } catch {
    return emptyBusiness();
  }
}

export function saveBusiness(business: Business) {
  if (!isBrowser()) return;
  window.localStorage.setItem(BUSINESS_KEY, JSON.stringify(business));
}

export function nextInvoiceNumber(): string {
  if (!isBrowser()) return "INV-0001";
  const prefs = loadPrefs();
  const raw = window.localStorage.getItem(COUNTER_KEY);
  const stored = raw ? parseInt(raw, 10) : 0;
  const current = Math.max(stored, prefs.nextNumber - 1);
  const next = current + 1;
  window.localStorage.setItem(COUNTER_KEY, String(next));
  savePrefs({ ...prefs, nextNumber: next + 1 });
  return `${prefs.numberPrefix}${String(next).padStart(prefs.numberPadding, "0")}`;
}

export function defaultPrefs(): InvoicePrefs {
  return {
    numberPrefix: "INV-",
    nextNumber: 1,
    numberPadding: 4,
    defaultTerms: "Payment due within 14 days.",
    defaultTaxLabel: "Tax",
    defaultTaxPercent: 0,
    defaultCurrencyCode: DEFAULT_CURRENCY.code,
    defaultDueDays: 14,
  };
}

export function loadPrefs(): InvoicePrefs {
  if (!isBrowser()) return defaultPrefs();
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs();
    return { ...defaultPrefs(), ...JSON.parse(raw) };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(prefs: InvoicePrefs) {
  if (!isBrowser()) return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadItems(): SavedItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveItems(list: SavedItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ITEMS_KEY, JSON.stringify(list));
}

export function upsertItem(item: SavedItem) {
  const list = loadItems();
  const idx = list.findIndex((i) => i.id === item.id);
  if (idx === -1) list.unshift(item);
  else list[idx] = item;
  saveItems(list);
}

export function removeItem(id: string) {
  saveItems(loadItems().filter((i) => i.id !== id));
}

export function emptyBusiness(): Business {
  return {
    name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    logoDataUrl: undefined,
  };
}

export function createId(): string {
  if (isBrowser() && "crypto" in window && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Format a Date in the user's LOCAL calendar, not UTC. `toISOString`
// converts to UTC first, so a user at UTC-8 at 11pm local on Nov 8
// would get "2026-11-09" — off by a day.
function formatLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return formatLocalISO(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  // `new Date("2026-11-09")` is parsed as UTC midnight, which shifts
  // the local calendar day in non-UTC time zones. Parse the parts and
  // build a local Date instead.
  const [y, m, day] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !day) return iso;
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + days);
  return formatLocalISO(d);
}

export function newInvoice(business?: Business): Invoice {
  const biz = business ?? loadBusiness();
  const prefs = loadPrefs();
  const issue = todayISO();
  return {
    id: createId(),
    number: isBrowser() ? nextInvoiceNumber() : `${prefs.numberPrefix}${String(prefs.nextNumber).padStart(prefs.numberPadding, "0")}`,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issueDate: issue,
    dueDate: addDaysISO(issue, prefs.defaultDueDays),
    poNumber: "",
    business: biz,
    billTo: { name: "", email: "", address: "", phone: "" },
    shipTo: { name: "", email: "", address: "", phone: "" },
    items: [
      { id: createId(), description: "", quantity: 1, rate: 0 },
    ],
    currency: findCurrency(prefs.defaultCurrencyCode),
    taxLabel: prefs.defaultTaxLabel,
    taxMode: "percent",
    taxValue: prefs.defaultTaxPercent,
    discountLabel: "Discount",
    discountMode: "percent",
    discountValue: 0,
    shipping: 0,
    notes: "",
    terms: prefs.defaultTerms,
    amountPaid: 0,
  };
}
