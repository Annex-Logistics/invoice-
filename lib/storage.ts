"use client";

import type { Business, Invoice } from "./types";
import { DEFAULT_CURRENCY } from "./currencies";

const INVOICES_KEY = "annexinvoice.invoices.v1";
const BUSINESS_KEY = "annexinvoice.business.v1";
const COUNTER_KEY  = "annexinvoice.counter.v1";

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
  const raw = window.localStorage.getItem(COUNTER_KEY);
  const current = raw ? parseInt(raw, 10) : 0;
  const next = (Number.isFinite(current) ? current : 0) + 1;
  window.localStorage.setItem(COUNTER_KEY, String(next));
  return `INV-${String(next).padStart(4, "0")}`;
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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function newInvoice(business?: Business): Invoice {
  const biz = business ?? loadBusiness();
  const issue = todayISO();
  return {
    id: createId(),
    number: isBrowser() ? nextInvoiceNumber() : "INV-0001",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issueDate: issue,
    dueDate: addDaysISO(issue, 14),
    poNumber: "",
    business: biz,
    billTo: { name: "", email: "", address: "", phone: "" },
    shipTo: { name: "", email: "", address: "", phone: "" },
    items: [
      { id: createId(), description: "", quantity: 1, rate: 0 },
    ],
    currency: DEFAULT_CURRENCY,
    taxLabel: "Tax",
    taxMode: "percent",
    taxValue: 0,
    discountLabel: "Discount",
    discountMode: "percent",
    discountValue: 0,
    shipping: 0,
    notes: "",
    terms: "Payment due within 14 days.",
    amountPaid: 0,
  };
}
