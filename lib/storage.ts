"use client";

import type {
  Business,
  Client,
  Invoice,
  BusinessProfile,
  InvoicePrefs,
  RecurringSchedule,
  SavedItem,
} from "./types";
import { buildRunInvoice, dueRuns, nextRunDate } from "./recurring";
import { DEFAULT_CURRENCY, findCurrency } from "./currencies";

const INVOICES_KEY  = "annexinvoice.invoices.v1";
const ESTIMATES_KEY = "annexinvoice.estimates.v1";
const BUSINESS_KEY  = "annexinvoice.business.v1";
const COUNTER_KEY   = "annexinvoice.counter.v1";
const EST_COUNTER_KEY = "annexinvoice.estimateCounter.v1";
const PREFS_KEY     = "annexinvoice.prefs.v1";
const ITEMS_KEY     = "annexinvoice.items.v1";
const CLIENTS_KEY   = "annexinvoice.clients.v1";
const RECURRING_KEY = "annexinvoice.recurring.v1";
const BUSINESSES_KEY = "annexinvoice.businesses.v1";
const CURRENT_BUSINESS_KEY = "annexinvoice.currentBusiness.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeInvoice(inv: Invoice): Invoice {
  // Records created before the kind/payments fields existed are
  // normalized on read so new code can assume they're there.
  if (!inv.kind) inv.kind = "invoice";
  return inv;
}

export function loadInvoices(): Invoice[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(INVOICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeInvoice) : [];
  } catch {
    return [];
  }
}

export function loadEstimates(): Invoice[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(ESTIMATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((e) => ({ ...e, kind: "estimate" as const }))
      : [];
  } catch {
    return [];
  }
}

export function saveEstimates(list: Invoice[]) {
  safeSet(ESTIMATES_KEY, JSON.stringify(list));
}

export function loadEstimate(id: string): Invoice | null {
  return loadEstimates().find((e) => e.id === id) ?? null;
}

export function upsertEstimate(estimate: Invoice) {
  const list = loadEstimates();
  const next: Invoice = {
    ...estimate,
    kind: "estimate",
    updatedAt: new Date().toISOString(),
  };
  const idx = list.findIndex((e) => e.id === estimate.id);
  if (idx === -1) list.unshift(next);
  else list[idx] = next;
  saveEstimates(list);
}

export function removeEstimate(id: string) {
  saveEstimates(loadEstimates().filter((e) => e.id !== id));
}

export function duplicateEstimate(id: string): Invoice | null {
  const source = loadEstimate(id);
  if (!source) return null;
  const clone: Invoice = {
    ...source,
    id: createId(),
    kind: "estimate",
    number: isBrowser() ? nextEstimateNumber() : source.number + "-copy",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issueDate: todayISO(),
    dueDate: addDaysISO(todayISO(), (loadPrefs().estimateDefaultValidDays ?? 30)),
    items: source.items.map((item) => ({ ...item, id: createId() })),
  };
  upsertEstimate(clone);
  return clone;
}

// Kind-aware wrappers so the shared editor doesn't need to branch
// on which storage key to write.
export function upsertDocument(doc: Invoice) {
  if (doc.kind === "estimate") upsertEstimate(doc);
  else upsertInvoice(doc);
}

export function removeDocument(doc: Invoice) {
  if (doc.kind === "estimate") removeEstimate(doc.id);
  else removeInvoice(doc.id);
}

export function duplicateDocument(doc: Invoice): Invoice | null {
  return doc.kind === "estimate"
    ? duplicateEstimate(doc.id)
    : duplicateInvoice(doc.id);
}

export function nextEstimateNumber(): string {
  if (!isBrowser()) return "EST-0001";
  const prefs = loadPrefs();
  const raw = window.localStorage.getItem(EST_COUNTER_KEY);
  const stored = raw ? parseInt(raw, 10) : 0;
  const prefix  = prefs.estimateNumberPrefix  ?? "EST-";
  const padding = prefs.estimateNumberPadding ?? 4;
  const seed    = prefs.estimateNextNumber    ?? 1;
  const format = (n: number) => `${prefix}${String(n).padStart(padding, "0")}`;
  const currentId = getCurrentBusinessId();
  const used = new Set(
    loadEstimates()
      .filter((e) => (e.businessId ?? currentId) === currentId)
      .map((e) => e.number)
  );
  let next = Math.max(stored, seed - 1) + 1;
  while (used.has(format(next))) next++;
  safeSet(EST_COUNTER_KEY, String(next));
  savePrefs({ ...prefs, estimateNextNumber: next + 1 });
  return format(next);
}

/**
 * Create an invoice from an existing estimate. Keeps the estimate in
 * place so you have a record of what was quoted vs what was billed.
 */
export function convertEstimateToInvoice(estimateId: string): Invoice | null {
  const source = loadEstimate(estimateId);
  if (!source) return null;
  const prefs = loadPrefs();
  const issue = todayISO();
  const invoice: Invoice = {
    ...source,
    id: createId(),
    kind: "invoice",
    number: isBrowser() ? nextInvoiceNumber() : source.number + "-INV",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issueDate: issue,
    dueDate: addDaysISO(issue, prefs.defaultDueDays),
    items: source.items.map((item) => ({ ...item, id: createId() })),
    amountPaid: 0,
    payments: [],
  };
  upsertInvoice(invoice);
  return invoice;
}

// ── Clients ────────────────────────────────────────────────────────────

export function loadClients(): Client[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveClients(list: Client[]) {
  safeSet(CLIENTS_KEY, JSON.stringify(list));
}

export function upsertClient(client: Client) {
  const list = loadClients();
  const idx = list.findIndex((c) => c.id === client.id);
  if (idx === -1) list.unshift(client);
  else list[idx] = client;
  saveClients(list);
}

export function removeClient(id: string) {
  saveClients(loadClients().filter((c) => c.id !== id));
}

function safeSet(key: string, value: string): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // Most likely QuotaExceededError (5–10 MB per origin). Make the
    // failure visible instead of silently losing the write.
    if (typeof window !== "undefined") {
      console.error("[AnnexInvoice] localStorage write failed", err);
      try {
        window.alert(
          "Your browser's storage is full. Export a backup from Settings and delete older invoices before adding new ones."
        );
      } catch {
        /* alert unavailable (e.g. during test) */
      }
    }
    return false;
  }
}

export function saveInvoices(list: Invoice[]) {
  safeSet(INVOICES_KEY, JSON.stringify(list));
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
    dueDate: addDaysISO(todayISO(), loadPrefs().defaultDueDays),
    amountPaid: 0,
    // A copy is a fresh bill: never carry the source's payments over
    // (they used to be copied, so duplicates showed as already paid).
    payments: [],
    recurringId: undefined,
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

// Fired after the active business's details change, so live UI (the
// business switcher) can refresh without a reload.
export const BUSINESS_CHANGED_EVENT = "annexinvoice:business-changed";

export function saveBusiness(business: Business) {
  safeSet(BUSINESS_KEY, JSON.stringify(business));
  if (isBrowser()) window.dispatchEvent(new Event(BUSINESS_CHANGED_EVENT));
}

/**
 * Issue the next invoice number for a business (default: the active
 * one). Each business has its own sequence. Sample data, imported
 * backups and hand-edited numbers don't move the counter, so numbers
 * already used by that business's invoices are skipped.
 */
export function nextInvoiceNumber(businessId?: string): string {
  if (!isBrowser()) return "INV-0001";
  const currentId = getCurrentBusinessId();
  const targetId = businessId ?? currentId;
  const used = new Set(
    loadInvoices()
      .filter((i) => (i.businessId ?? currentId) === targetId)
      .map((i) => i.number)
  );

  if (targetId === currentId) {
    const prefs = loadPrefs();
    const raw = window.localStorage.getItem(COUNTER_KEY);
    const stored = raw ? parseInt(raw, 10) : 0;
    const format = (n: number) => `${prefs.numberPrefix}${String(n).padStart(prefs.numberPadding, "0")}`;
    let next = Math.max(stored, prefs.nextNumber - 1) + 1;
    while (used.has(format(next))) next++;
    safeSet(COUNTER_KEY, String(next));
    savePrefs({ ...prefs, nextNumber: next + 1 });
    return format(next);
  }

  // A parked business (e.g. its recurring invoice ran while another
  // business is active): number from its stored profile.
  const profiles = loadProfiles();
  const profile = profiles.find((p) => p.id === targetId);
  if (!profile) return nextInvoiceNumber(currentId);
  const prefs = profile.prefs;
  const format = (n: number) => `${prefs.numberPrefix}${String(n).padStart(prefs.numberPadding, "0")}`;
  let next = Math.max(profile.counter, prefs.nextNumber - 1) + 1;
  while (used.has(format(next))) next++;
  profile.counter = next;
  profile.prefs = { ...prefs, nextNumber: next + 1 };
  saveProfiles(profiles);
  return format(next);
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
  safeSet(PREFS_KEY, JSON.stringify(prefs));
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
  safeSet(ITEMS_KEY, JSON.stringify(list));
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
    kind: "invoice",
    number: isBrowser() ? nextInvoiceNumber() : `${prefs.numberPrefix}${String(prefs.nextNumber).padStart(prefs.numberPadding, "0")}`,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issueDate: issue,
    dueDate: addDaysISO(issue, prefs.defaultDueDays),
    poNumber: "",
    businessId: isBrowser() ? getCurrentBusinessId() : undefined,
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
    payments: [],
  };
}

export function newEstimate(business?: Business): Invoice {
  const biz = business ?? loadBusiness();
  const prefs = loadPrefs();
  const issue = todayISO();
  const validDays = prefs.estimateDefaultValidDays ?? 30;
  const defaultTerms = prefs.estimateDefaultTerms ?? "This estimate is valid for 30 days. Accepting it authorizes the work described above.";
  return {
    id: createId(),
    kind: "estimate",
    number: isBrowser()
      ? nextEstimateNumber()
      : `${prefs.estimateNumberPrefix ?? "EST-"}${String(prefs.estimateNextNumber ?? 1).padStart(prefs.estimateNumberPadding ?? 4, "0")}`,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issueDate: issue,
    dueDate: addDaysISO(issue, validDays), // "valid until"
    poNumber: "",
    businessId: isBrowser() ? getCurrentBusinessId() : undefined,
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
    terms: defaultTerms,
    amountPaid: 0,
    payments: [],
  };
}

// ── Recurring schedules ────────────────────────────────────────────────

export function loadSchedules(): RecurringSchedule[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(RECURRING_KEY);
    return raw ? (JSON.parse(raw) as RecurringSchedule[]) : [];
  } catch {
    return [];
  }
}

export function saveSchedules(list: RecurringSchedule[]) {
  safeSet(RECURRING_KEY, JSON.stringify(list));
}

export function upsertSchedule(schedule: RecurringSchedule) {
  const list = loadSchedules();
  const idx = list.findIndex((s) => s.id === schedule.id);
  if (idx === -1) list.unshift(schedule);
  else list[idx] = schedule;
  saveSchedules(list);
}

export function removeSchedule(id: string) {
  saveSchedules(loadSchedules().filter((s) => s.id !== id));
}

export function scheduleForInvoice(invoiceId: string): RecurringSchedule | undefined {
  return loadSchedules().find((s) => s.sourceInvoiceId === invoiceId);
}

/**
 * Generate every recurring invoice that has come due. Called whenever
 * the app shell mounts (there is no backend scheduler). Idempotent per
 * (schedule, run date): if another tab already generated a run, it is
 * skipped rather than duplicated. Returns how many invoices were made.
 */
export function runDueSchedules(today = todayISO()): number {
  if (!isBrowser()) return 0;
  const schedules = loadSchedules();
  if (schedules.length === 0) return 0;
  let invoices = loadInvoices();
  let created = 0;
  let changed = false;

  for (const s of schedules) {
    if (!s.active) continue;
    const runs = dueRuns(s, today);
    if (runs.length === 0) {
      if (nextRunDate(s) === null) {
        s.active = false; // past its end date
        changed = true;
      }
      continue;
    }
    const source = invoices.find((i) => i.id === s.sourceInvoiceId);
    if (!source) {
      s.active = false;
      s.problem = "source-missing";
      changed = true;
      continue;
    }
    for (const runDate of runs) {
      const exists = invoices.some((i) => i.recurringId === s.id && i.issueDate === runDate);
      if (!exists) {
        const inv = buildRunInvoice(source, s, runDate, {
          id: createId(),
          number: nextInvoiceNumber(source.businessId),
          now: new Date().toISOString(),
          newLineId: createId,
        });
        invoices = [inv, ...invoices];
        created++;
      }
      s.runCount++;
      s.lastRunDate = runDate;
      changed = true;
    }
    if (nextRunDate(s) === null) s.active = false;
  }

  if (created > 0) saveInvoices(invoices);
  if (changed) saveSchedules(schedules);
  return created;
}

// ── Businesses ─────────────────────────────────────────────────────────

export function loadProfiles(): BusinessProfile[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(BUSINESSES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProfiles(list: BusinessProfile[]) {
  safeSet(BUSINESSES_KEY, JSON.stringify(list));
}

function readCounter(key: string): number {
  const raw = window.localStorage.getItem(key);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Make sure at least one business profile exists. On first run after
 * upgrading, the existing single business becomes the first profile and
 * every existing document is stamped as belonging to it.
 */
export function ensureBusinesses(): string {
  const profiles = loadProfiles();
  const current = window.localStorage.getItem(CURRENT_BUSINESS_KEY);
  if (profiles.length > 0) {
    if (current && profiles.some((p) => p.id === current)) return current;
    safeSet(CURRENT_BUSINESS_KEY, profiles[0].id);
    return profiles[0].id;
  }
  const id = createId();
  saveProfiles([
    {
      id,
      business: loadBusiness(),
      prefs: loadPrefs(),
      counter: readCounter(COUNTER_KEY),
      estimateCounter: readCounter(EST_COUNTER_KEY),
    },
  ]);
  safeSet(CURRENT_BUSINESS_KEY, id);
  const stamp = (list: Invoice[]) => list.map((d) => (d.businessId ? d : { ...d, businessId: id }));
  saveInvoices(stamp(loadInvoices()));
  saveEstimates(stamp(loadEstimates()));
  return id;
}

export function getCurrentBusinessId(): string {
  if (!isBrowser()) return "";
  return ensureBusinesses();
}

// Documents shown in lists, totals and reports: the active business's.
export function ownedByCurrent(doc: Invoice, currentId = getCurrentBusinessId()): boolean {
  return !doc.businessId || doc.businessId === currentId;
}

export function loadCurrentInvoices(): Invoice[] {
  const id = getCurrentBusinessId();
  return loadInvoices().filter((d) => ownedByCurrent(d, id));
}

export function loadCurrentEstimates(): Invoice[] {
  const id = getCurrentBusinessId();
  return loadEstimates().filter((d) => ownedByCurrent(d, id));
}

// Copy the active business's live keys into its profile record.
export function syncActiveProfile(): BusinessProfile[] {
  const id = getCurrentBusinessId();
  const profiles = loadProfiles().map((p) =>
    p.id === id
      ? {
          ...p,
          business: loadBusiness(),
          prefs: loadPrefs(),
          counter: readCounter(COUNTER_KEY),
          estimateCounter: readCounter(EST_COUNTER_KEY),
        }
      : p
  );
  saveProfiles(profiles);
  return profiles;
}

export function listBusinesses(): BusinessProfile[] {
  if (!isBrowser()) return [];
  return syncActiveProfile();
}

function activate(target: BusinessProfile) {
  // Order matters. saveBusiness() fires BUSINESS_CHANGED_EVENT, whose
  // listeners call syncActiveProfile(), which copies the live keys into
  // whichever profile is marked current. So mark the target current
  // first and write the business last, when every key is consistent;
  // otherwise the target's details get copied onto the previous business.
  safeSet(CURRENT_BUSINESS_KEY, target.id);
  savePrefs(target.prefs);
  safeSet(COUNTER_KEY, String(target.counter));
  safeSet(EST_COUNTER_KEY, String(target.estimateCounter));
  saveBusiness(target.business);
}

export function switchBusiness(id: string): boolean {
  const profiles = syncActiveProfile();
  const target = profiles.find((p) => p.id === id);
  if (!target) return false;
  activate(target);
  return true;
}

// Create a business and make it active. Starts with the current
// business's currency and tax defaults, and fresh numbering.
export function addBusiness(name: string): BusinessProfile {
  const profiles = syncActiveProfile();
  const base = loadPrefs();
  const profile: BusinessProfile = {
    id: createId(),
    business: { ...emptyBusiness(), name: name.trim().slice(0, 200) },
    prefs: {
      ...defaultPrefs(),
      defaultCurrencyCode: base.defaultCurrencyCode,
      defaultTaxLabel: base.defaultTaxLabel,
      defaultTaxPercent: base.defaultTaxPercent,
    },
    counter: 0,
    estimateCounter: 0,
  };
  saveProfiles([...profiles, profile]);
  activate(profile);
  return profile;
}

export function businessDocCount(id: string): number {
  const currentId = getCurrentBusinessId();
  const owns = (d: Invoice) => (d.businessId ?? currentId) === id;
  return loadInvoices().filter(owns).length + loadEstimates().filter(owns).length;
}

// Only an inactive business with no documents can be removed, so no
// document ever loses its owner.
export function removeBusiness(id: string): boolean {
  if (id === getCurrentBusinessId() || businessDocCount(id) > 0) return false;
  saveProfiles(loadProfiles().filter((p) => p.id !== id));
  return true;
}

// Restore businesses from a backup: replace profiles and load the
// chosen one into the active keys.
export function restoreBusinesses(profiles: BusinessProfile[], currentId?: string) {
  if (profiles.length === 0) return;
  saveProfiles(profiles);
  activate(profiles.find((p) => p.id === currentId) ?? profiles[0]);
}

// Forget every business (used by "Reset everything").
export function clearBusinesses() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(BUSINESSES_KEY);
  window.localStorage.removeItem(CURRENT_BUSINESS_KEY);
  window.localStorage.removeItem(COUNTER_KEY);
  window.localStorage.removeItem(EST_COUNTER_KEY);
}
