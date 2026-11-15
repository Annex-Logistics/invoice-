"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Eye,
  Save,
  Send,
  Check,
  Trash2,
  Copy,
  Mail,
  Library,
  Plus,
  Users,
  FileCheck,
  X,
  CreditCard,
  Repeat,
  Receipt,
  Truck,
} from "lucide-react";
import type {
  Invoice,
  LineItem,
  Party,
  Business,
  Payment,
  PaymentMethod,
  Client,
  RecurringSchedule,
} from "@/lib/types";
import { CURRENCIES, findCurrency, formatMoney } from "@/lib/currencies";
import {
  convertEstimateToInvoice,
  createFromInvoice,
  createId,
  duplicateDocument,
  loadClients,
  loadItems,
  ownedByCurrent,
  removeDocument,
  saveBusiness,
  scheduleForInvoice,
  todayISO,
  upsertClient,
  upsertDocument,
  upsertItem,
} from "@/lib/storage";
import { sumPayments } from "@/lib/totals";
import { buildInvoiceMailto } from "@/lib/email";
import { calcTotals } from "@/lib/totals";
import { exportInvoicePdf } from "@/lib/pdf";
import { LineItemsTable } from "./LineItemsTable";
import { LogoUpload } from "./LogoUpload";
import { InvoicePreview } from "./InvoicePreview";
import { StatusBadge } from "./StatusBadge";
import { RecurringModal } from "./RecurringModal";
import { frequencyLabel } from "@/lib/recurring";
import { docType } from "@/lib/docTypes";

type Props = {
  initialInvoice: Invoice;
  isNew?: boolean;
};


export function InvoiceEditor({ initialInvoice, isNew = false }: Props) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  const [showPreview, setShowPreview] = useState(false);
  const [showShipTo, setShowShipTo] = useState(
    !!(initialInvoice.shipTo && (initialInvoice.shipTo.name || initialInvoice.shipTo.address))
  );
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [showLibrary, setShowLibrary] = useState(false);
  const [showClients, setShowClients] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [schedule, setSchedule] = useState<RecurringSchedule | undefined>(undefined);

  const cfg = docType(invoice.kind);
  const isEstimate = cfg.kind === "estimate";
  const isInvoice = cfg.kind === "invoice";
  const listPath = cfg.path;
  const docLabel = cfg.label;
  const statusOptions = cfg.statuses;

  const totals = useMemo(() => calcTotals(invoice), [invoice]);

  useEffect(() => {
    if (docType(initialInvoice.kind).kind === "invoice") {
      setSchedule(scheduleForInvoice(initialInvoice.id));
    }
  }, [initialInvoice.id, initialInvoice.kind]);

  function openRecurring() {
    // The schedule copies the stored invoice, so make sure it's saved.
    upsertDocument(invoice);
    setShowRecurring(true);
  }

  // Auto-save (debounced) — skip the first render so just opening an
  // invoice doesn't bump its updatedAt or flash "Saving...".
  const didMountRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only propagate business changes to the GLOBAL store when the user
  // actually edited them here. Otherwise opening an older invoice and
  // editing anything would overwrite newer Settings → business info.
  const initialBusinessRef = useRef(JSON.stringify(initialInvoice.business));
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setSaved("saving");
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    const t = setTimeout(() => {
      upsertDocument(invoice);
      const bizSnapshot = JSON.stringify(invoice.business);
      // Only the active business's settings follow edits made here; a
      // document from another business keeps its own snapshot.
      if (bizSnapshot !== initialBusinessRef.current && ownedByCurrent(invoice)) {
        saveBusiness(invoice.business);
        initialBusinessRef.current = bizSnapshot;
      }
      setSaved("saved");
      hideTimerRef.current = setTimeout(() => setSaved("idle"), 1200);
    }, 500);
    return () => clearTimeout(t);
  }, [invoice]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    []
  );

  function patch<K extends keyof Invoice>(key: K, value: Invoice[K]) {
    setInvoice((prev) => ({ ...prev, [key]: value }));
  }

  function patchBusiness(patchBiz: Partial<Business>) {
    setInvoice((prev) => ({ ...prev, business: { ...prev.business, ...patchBiz } }));
  }

  function patchBillTo(patchParty: Partial<Party>) {
    setInvoice((prev) => ({ ...prev, billTo: { ...prev.billTo, ...patchParty } }));
  }

  function patchShipTo(patchParty: Partial<Party>) {
    setInvoice((prev) => ({
      ...prev,
      shipTo: { ...(prev.shipTo ?? { name: "", email: "", address: "", phone: "" }), ...patchParty },
    }));
  }

  function setItems(items: LineItem[]) {
    setInvoice((prev) => ({ ...prev, items }));
  }

  function handleDelete() {
    if (!confirm(`Delete this ${docLabel.toLowerCase()}? This cannot be undone.`)) return;
    removeDocument(invoice);
    router.push(listPath);
  }

  async function handleDownload() {
    await exportInvoicePdf(invoice);
  }

  function handleMarkSent() {
    patch("status", "sent");
  }

  function handleConvertToInvoice() {
    upsertDocument(invoice);
    const created = convertEstimateToInvoice(invoice.id);
    if (created) router.push(`/invoices/${created.id}`);
  }

  function handleCreateFrom(kind: "receipt" | "delivery-note") {
    upsertDocument(invoice);
    const created = createFromInvoice(invoice.id, kind);
    if (created) router.push(`${docType(kind).path}/${created.id}`);
  }

  function handleDuplicate() {
    upsertDocument(invoice);
    const copy = duplicateDocument(invoice);
    if (copy) router.push(`${listPath}/${copy.id}`);
  }

  function handleEmail() {
    const href = buildInvoiceMailto(invoice);
    window.location.href = href;
  }

  function handleSaveToLibrary() {
    // Only a description is required — a rate of 0 is legitimate
    // (free item, "included", etc.).
    const nonEmpty = invoice.items.filter((i) => i.description.trim());
    if (nonEmpty.length === 0) {
      alert("Add at least one line item with a description first.");
      return;
    }
    nonEmpty.forEach((item) => {
      upsertItem({ id: createId(), description: item.description.trim(), rate: Number(item.rate) || 0 });
    });
    alert(`Saved ${nonEmpty.length} item${nonEmpty.length === 1 ? "" : "s"} to your library.`);
  }

  function handleInsertFromLibrary() {
    setShowLibrary(true);
  }

  function addPayment() {
    const t = calcTotals(invoice);
    const existing = invoice.payments ?? [];
    const defaultAmount = Math.max(0, t.total - sumPayments(invoice));
    const next: Payment = {
      id: createId(),
      date: todayISO(),
      amount: Math.round(defaultAmount * 100) / 100,
      method: "bank-transfer",
      note: "",
    };
    setInvoice((prev) => ({ ...prev, amountPaid: 0, payments: [...existing, next] }));
  }

  function patchPayment(id: string, patchFields: Partial<Payment>) {
    const existing = invoice.payments ?? [];
    setInvoice((prev) => ({
      ...prev,
      payments: existing.map((p) => (p.id === id ? { ...p, ...patchFields } : p)),
    }));
  }

  function removePayment(id: string) {
    const existing = invoice.payments ?? [];
    setInvoice((prev) => ({ ...prev, payments: existing.filter((p) => p.id !== id) }));
  }

  function pickClient(client: Client) {
    setInvoice((prev) => ({
      ...prev,
      clientId: client.id,
      billTo: {
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
      },
    }));
    setShowClients(false);
  }

  function saveCurrentAsClient() {
    const b = invoice.billTo;
    if (!b.name.trim() && !b.email.trim()) {
      alert("Fill at least a name or email before saving as a client.");
      return;
    }
    const id = createId();
    upsertClient({
      id,
      name: b.name.trim(),
      email: b.email.trim(),
      phone: b.phone.trim(),
      address: b.address.trim(),
    });
    setInvoice((prev) => ({ ...prev, clientId: id }));
    alert("Client saved to your client list.");
  }

  function insertLibraryItem(description: string, rate: number) {
    const current = invoice.items;
    // If the only line is empty, replace it instead of appending.
    if (current.length === 1 && !current[0].description && !current[0].rate) {
      setItems([{ id: createId(), description, quantity: 1, rate }]);
    } else {
      setItems([
        ...current,
        { id: createId(), description, quantity: 1, rate },
      ]);
    }
    setShowLibrary(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={listPath} className="btn-ghost -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-ink-900">
                {isNew ? `New ${docLabel.toLowerCase()}` : `Edit ${invoice.number}`}
              </h1>
              <StatusBadge status={invoice.status} />
              {invoice.recurringId && (
                <Link
                  href="/recurring"
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700"
                  title="Created by a recurring schedule"
                >
                  <Repeat className="h-3 w-3" /> Recurring
                </Link>
              )}
            </div>
            <div className="text-xs text-ink-500">
              {saved === "saving" && "Saving..."}
              {saved === "saved" && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
              {saved === "idle" && "All changes saved locally"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4" /> Preview
          </button>
          <button className="btn-secondary" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download PDF
          </button>
          <button className="btn-secondary" onClick={handleEmail} disabled={!invoice.billTo.email}>
            <Mail className="h-4 w-4" /> Email
          </button>
          {isEstimate && !isNew && (
            <button className="btn-primary" onClick={handleConvertToInvoice}>
              <FileCheck className="h-4 w-4" /> Convert to invoice
            </button>
          )}
          {isInvoice && (
            <button className="btn-secondary" onClick={openRecurring}>
              <Repeat className="h-4 w-4" />
              {schedule ? `Repeats ${frequencyLabel(schedule.frequency).toLowerCase()}` : "Repeat"}
            </button>
          )}
          {isInvoice && (
            <button className="btn-primary" onClick={handleMarkSent}>
              <Send className="h-4 w-4" /> Mark as sent
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main form */}
        <div className="space-y-6">
          {/* Business + meta */}
          <section className="card p-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr_240px]">
              <LogoUpload
                value={invoice.business.logoDataUrl}
                onChange={(d) => patchBusiness({ logoDataUrl: d })}
              />
              <div className="space-y-2">
                <input
                  className="field-ghost text-lg font-semibold"
                  placeholder="Your business name"
                  maxLength={200}
                  value={invoice.business.name}
                  onChange={(e) => patchBusiness({ name: e.target.value })}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="field-ghost" placeholder="Email" maxLength={320}
                    value={invoice.business.email}
                    onChange={(e) => patchBusiness({ email: e.target.value })} />
                  <input className="field-ghost" placeholder="Phone" maxLength={64}
                    value={invoice.business.phone}
                    onChange={(e) => patchBusiness({ phone: e.target.value })} />
                </div>
                <textarea
                  rows={2}
                  className="field-ghost resize-none"
                  placeholder="Business address"
                  maxLength={500}
                  value={invoice.business.address}
                  onChange={(e) => patchBusiness({ address: e.target.value })}
                />
                <input className="field-ghost" placeholder="Website" maxLength={300}
                  value={invoice.business.website}
                  onChange={(e) => patchBusiness({ website: e.target.value })} />
              </div>

              <div className="space-y-3 md:border-l md:border-ink-100 md:pl-5">
                <div>
                  <label className="label">{docLabel} #</label>
                  <input className="field" maxLength={64}
                    value={invoice.number}
                    onChange={(e) => patch("number", e.target.value)} />
                </div>
                <div className={cfg.dueLabel ? "grid grid-cols-2 gap-2" : ""}>
                  <div>
                    <label className="label">{cfg.dueLabel ? "Issue" : "Date"}</label>
                    <input type="date" className="field"
                      value={invoice.issueDate}
                      onChange={(e) => patch("issueDate", e.target.value)} />
                  </div>
                  {cfg.dueLabel && (
                    <div>
                      <label className="label">{cfg.dueLabel}</label>
                      <input type="date" className="field"
                        value={invoice.dueDate}
                        onChange={(e) => patch("dueDate", e.target.value)} />
                    </div>
                  )}
                </div>
                {invoice.sourceNumber && (
                  <p className="text-xs text-ink-500">For invoice {invoice.sourceNumber}</p>
                )}
                <div>
                  <label className="label">PO #</label>
                  <input className="field" maxLength={64}
                    value={invoice.poNumber ?? ""}
                    onChange={(e) => patch("poNumber", e.target.value)} />
                </div>
              </div>
            </div>
          </section>

          {/* Bill to / Ship to */}
          <section className="card p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-900">{cfg.partyLabel}</h3>
                    {invoice.clientId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                        Saved client
                        <button
                          type="button"
                          onClick={() => setInvoice((prev) => ({ ...prev, clientId: undefined }))}
                          className="rounded-full hover:text-brand-900"
                          aria-label="Unlink saved client"
                          title="Stop attributing this document to the saved client"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowClients(true)}
                      className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
                    >
                      <Users className="h-3.5 w-3.5" /> Pick client
                    </button>
                    <span className="text-ink-300">·</span>
                    <button
                      type="button"
                      onClick={saveCurrentAsClient}
                      className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Save as client
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <input className="field" placeholder="Client / company name" maxLength={200}
                    value={invoice.billTo.name}
                    onChange={(e) => patchBillTo({ name: e.target.value })} />
                  <input className="field" type="email" placeholder="Email" maxLength={320}
                    value={invoice.billTo.email}
                    onChange={(e) => patchBillTo({ email: e.target.value })} />
                  <input className="field" placeholder="Phone" maxLength={64}
                    value={invoice.billTo.phone}
                    onChange={(e) => patchBillTo({ phone: e.target.value })} />
                  <textarea rows={3} className="field resize-none" placeholder="Billing address" maxLength={500}
                    value={invoice.billTo.address}
                    onChange={(e) => patchBillTo({ address: e.target.value })} />
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink-900">Ship To</h3>
                  <button
                    type="button"
                    onClick={() => setShowShipTo((s) => !s)}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    {showShipTo ? "Remove" : "+ Add shipping address"}
                  </button>
                </div>
                {showShipTo ? (
                  <div className="space-y-2">
                    <input className="field" placeholder="Name" maxLength={200}
                      value={invoice.shipTo?.name ?? ""}
                      onChange={(e) => patchShipTo({ name: e.target.value })} />
                    <input className="field" type="email" placeholder="Email" maxLength={320}
                      value={invoice.shipTo?.email ?? ""}
                      onChange={(e) => patchShipTo({ email: e.target.value })} />
                    <input className="field" placeholder="Phone" maxLength={64}
                      value={invoice.shipTo?.phone ?? ""}
                      onChange={(e) => patchShipTo({ phone: e.target.value })} />
                    <textarea rows={3} className="field resize-none" placeholder="Shipping address" maxLength={500}
                      value={invoice.shipTo?.address ?? ""}
                      onChange={(e) => patchShipTo({ address: e.target.value })} />
                  </div>
                ) : (
                  <div className="flex h-full min-h-[120px] items-center justify-center rounded-md border border-dashed border-ink-200 p-4 text-center text-sm text-ink-400">
                    No shipping address
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Line items */}
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-900">Line items</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <button
                  type="button"
                  className="btn-ghost !py-1 text-xs"
                  onClick={handleInsertFromLibrary}
                  title="Insert from your saved items library"
                >
                  <Library className="h-3.5 w-3.5" /> From library
                </button>
                <button
                  type="button"
                  className="btn-ghost !py-1 text-xs"
                  onClick={handleSaveToLibrary}
                  title="Save these line items to your library"
                >
                  <Plus className="h-3.5 w-3.5" /> Save items
                </button>
                <label htmlFor="currency" className="ml-2 font-medium">Currency</label>
                <select
                  id="currency"
                  className="field !w-auto !py-1.5 text-xs"
                  value={invoice.currency.code}
                  onChange={(e) => patch("currency", findCurrency(e.target.value))}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <LineItemsTable
              items={invoice.items}
              currency={invoice.currency}
              onChange={setItems}
              showPrices={cfg.prices}
            />
          </section>

          {/* Notes + Totals */}
          <section className="grid gap-5 md:grid-cols-5">
            <div className={(cfg.prices ? "md:col-span-3" : "md:col-span-5") + " space-y-4"}>
              <div>
                <label className="label">Notes</label>
                <textarea
                  rows={3}
                  className="field resize-none"
                  placeholder="Thank you for your business."
                  maxLength={2000}
                  value={invoice.notes}
                  onChange={(e) => patch("notes", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Terms &amp; conditions</label>
                <textarea
                  rows={3}
                  className="field resize-none"
                  placeholder="Payment due in 14 days. Late payments subject to 1.5% monthly interest."
                  maxLength={5000}
                  value={invoice.terms}
                  onChange={(e) => patch("terms", e.target.value)}
                />
              </div>
            </div>

            {cfg.prices && (
            <div className="md:col-span-2">
              <div className="card p-5">
                <TotalRow
                  label="Subtotal"
                  value={formatMoney(totals.subtotal, invoice.currency)}
                />

                <TotalsAdjustmentRow
                  label={invoice.discountLabel}
                  mode={invoice.discountMode}
                  value={invoice.discountValue}
                  currencySymbol={invoice.currency.symbol}
                  onLabel={(v) => patch("discountLabel", v)}
                  onMode={(v) => patch("discountMode", v as Invoice["discountMode"])}
                  onValue={(v) => patch("discountValue", v)}
                />

                <TotalsAdjustmentRow
                  label={invoice.taxLabel}
                  mode={invoice.taxMode}
                  value={invoice.taxValue}
                  currencySymbol={invoice.currency.symbol}
                  onLabel={(v) => patch("taxLabel", v)}
                  onMode={(v) => patch("taxMode", v as Invoice["taxMode"])}
                  onValue={(v) => patch("taxValue", v)}
                />

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm text-ink-600">Shipping</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="field w-[92px] text-right"
                    value={invoice.shipping}
                    onChange={(e) => patch("shipping", parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="my-4 border-t border-ink-100" />

                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-ink-900">Total</span>
                  <span className="text-xl font-bold text-brand-700">
                    {formatMoney(totals.total, invoice.currency)}
                  </span>
                </div>

                {cfg.payments && (
                  <>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-sm text-ink-600">Amount paid</span>
                      <span className="text-sm font-medium text-ink-900">
                        {formatMoney(sumPayments(invoice), invoice.currency)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between rounded-md bg-ink-50 px-3 py-2">
                      <span className="text-sm font-semibold text-ink-900">Balance due</span>
                      <span className="text-lg font-bold text-ink-900">
                        {formatMoney(totals.balanceDue, invoice.currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            )}
          </section>

          {/* Payments */}
          {cfg.payments && (
            <section className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-ink-400" />
                  <h3 className="text-sm font-semibold text-ink-900">Payments received</h3>
                </div>
                <button type="button" className="btn-ghost !py-1 text-xs" onClick={addPayment}>
                  <Plus className="h-3.5 w-3.5" /> Record payment
                </button>
              </div>

              {(invoice.payments ?? []).length === 0 ? (
                <div className="rounded-md border border-dashed border-ink-200 p-6 text-center text-sm text-ink-400">
                  No payments recorded yet. Record each one — date, method and amount — to track the balance due.
                </div>
              ) : (
                <ul className="divide-y divide-ink-100 rounded-md border border-ink-100">
                  {(invoice.payments ?? []).map((p) => (
                    <li key={p.id} className="grid grid-cols-1 gap-2 px-3 py-3 md:grid-cols-[140px_1fr_140px_120px_32px] md:items-center">
                      <input
                        type="date"
                        className="field"
                        value={p.date}
                        onChange={(e) => patchPayment(p.id, { date: e.target.value })}
                      />
                      <select
                        className="field"
                        value={p.method}
                        onChange={(e) => patchPayment(p.id, { method: e.target.value as PaymentMethod })}
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="bank-transfer">Bank transfer</option>
                        <option value="check">Check</option>
                        <option value="paypal">PayPal</option>
                        <option value="stripe">Stripe</option>
                        <option value="other">Other</option>
                      </select>
                      <input
                        className="field"
                        placeholder="Note (optional)"
                        maxLength={200}
                        value={p.note}
                        onChange={(e) => patchPayment(p.id, { note: e.target.value })}
                      />
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="field text-right"
                        value={p.amount}
                        onChange={(e) =>
                          patchPayment(p.id, { amount: parseFloat(e.target.value) || 0 })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removePayment(p.id)}
                        className="rounded p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove payment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Danger */}
          {!isNew && (
            <div className="pt-4">
              <button className="btn-danger" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
                Delete {docLabel.toLowerCase()}
              </button>
            </div>
          )}
        </div>

        {/* Right rail */}
        {/* Below the form on small screens (it used to be hidden there,
            leaving no way to change status or duplicate on a phone). */}
        <aside>
          <div className="space-y-4 lg:sticky lg:top-6">
            <div className="card p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Status
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map((s) => {
                  const active = invoice.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => patch("status", s)}
                      className={
                        "rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors " +
                        (active
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-ink-200 text-ink-600 hover:border-ink-300")
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Quick actions
              </h4>
              <div className="space-y-2">
                <button className="btn-secondary w-full" onClick={() => setShowPreview(true)}>
                  <Eye className="h-4 w-4" /> Preview
                </button>
                <button className="btn-secondary w-full" onClick={handleDownload}>
                  <Download className="h-4 w-4" /> Download PDF
                </button>
                {!isNew && (
                  <button className="btn-secondary w-full" onClick={handleDuplicate}>
                    <Copy className="h-4 w-4" /> Duplicate
                  </button>
                )}
                {isInvoice && !isNew && (
                  <>
                    <button className="btn-secondary w-full" onClick={() => handleCreateFrom("receipt")}>
                      <Receipt className="h-4 w-4" /> Create receipt
                    </button>
                    <button className="btn-secondary w-full" onClick={() => handleCreateFrom("delivery-note")}>
                      <Truck className="h-4 w-4" /> Create delivery note
                    </button>
                  </>
                )}
                <button className="btn-primary w-full" onClick={() => upsertDocument(invoice)}>
                  <Save className="h-4 w-4" /> Save
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {showPreview && (
        <PreviewModal onClose={() => setShowPreview(false)} title={`${docLabel} preview`}>
          <InvoicePreview invoice={invoice} />
          <div className="no-print flex justify-end gap-2 p-4">
            <button className="btn-secondary" onClick={() => setShowPreview(false)}>
              Close
            </button>
            <button className="btn-secondary" onClick={() => window.print()}>
              Print
            </button>
            <button className="btn-primary" onClick={handleDownload}>
              <Download className="h-4 w-4" /> Download PDF
            </button>
          </div>
        </PreviewModal>
      )}

      {showLibrary && (
        <LibraryModal
          onClose={() => setShowLibrary(false)}
          onPick={insertLibraryItem}
          currencySymbol={invoice.currency.symbol}
        />
      )}

      {showRecurring && (
        <RecurringModal
          source={invoice}
          existing={schedule}
          onClose={() => setShowRecurring(false)}
          onChange={setSchedule}
        />
      )}

      {showClients && (
        <ClientPickerModal
          onClose={() => setShowClients(false)}
          onPick={pickClient}
        />
      )}
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-sm text-ink-600">{label}</span>
      <span className="text-sm font-medium text-ink-900">{value}</span>
    </div>
  );
}

function TotalsAdjustmentRow({
  label,
  mode,
  value,
  currencySymbol,
  onLabel,
  onMode,
  onValue,
}: {
  label: string;
  mode: "percent" | "fixed";
  value: number;
  currencySymbol: string;
  onLabel: (v: string) => void;
  onMode: (v: "percent" | "fixed") => void;
  onValue: (v: number) => void;
}) {
  return (
    <div className="mt-3 space-y-1.5">
      <input
        className="field-ghost w-full text-sm"
        value={label}
        onChange={(e) => onLabel(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-ink-200 bg-white text-xs">
          <button
            type="button"
            onClick={() => onMode("percent")}
            className={
              "rounded-l-md px-2.5 py-1.5 font-medium transition-colors " +
              (mode === "percent" ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50")
            }
          >
            %
          </button>
          <button
            type="button"
            onClick={() => onMode("fixed")}
            className={
              "rounded-r-md border-l border-ink-200 px-2.5 py-1.5 font-medium transition-colors " +
              (mode === "fixed" ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50")
            }
          >
            {currencySymbol}
          </button>
        </div>
        <input
          type="number"
          min={0}
          step="any"
          className="field flex-1 text-right"
          value={value}
          onChange={(e) => onValue(parseFloat(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}

function PreviewModal({
  children,
  onClose,
  title = "Invoice preview",
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-8 w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          <button className="btn-ghost -mr-2" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ClientPickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (client: Client) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setClients(loadClients());
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
      )
    : clients;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-16 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-900">Pick a client</h3>
          <button className="btn-ghost -mr-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-ink-100 p-3">
          <input
            autoFocus
            className="field"
            placeholder="Search name, email, phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {clients.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-500">
            No saved clients yet. Fill the Bill-To fields and click <strong>Save as client</strong>, or add them on the Clients page.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-500">No matches.</div>
        ) : (
          <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-ink-50"
                >
                  <span className="text-sm font-semibold text-ink-900">{c.name || "Unnamed client"}</span>
                  {c.email && <span className="text-xs text-ink-500">{c.email}</span>}
                  {c.address && <span className="text-xs text-ink-400 line-clamp-1">{c.address.split("\n")[0]}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LibraryModal({
  onClose,
  onPick,
  currencySymbol,
}: {
  onClose: () => void;
  onPick: (description: string, rate: number) => void;
  currencySymbol: string;
}) {
  const [items, setItems] = useState<ReturnType<typeof loadItems>>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setItems(loadItems());
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => it.description.toLowerCase().includes(q))
    : items;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-16 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-900">Insert from library</h3>
          <button className="btn-ghost -mr-2" onClick={onClose}>Close</button>
        </div>

        <div className="border-b border-ink-100 p-3">
          <input
            autoFocus
            className="field"
            placeholder="Search your saved items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-500">
            Your library is empty. Save items from the invoice editor, or add them in Settings.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-500">No matches.</div>
        ) : (
          <ul className="max-h-80 divide-y divide-ink-100 overflow-y-auto">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onPick(item.description, item.rate)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50"
                >
                  <span className="min-w-0 truncate text-sm text-ink-900">{item.description}</span>
                  <span className="text-sm font-medium text-ink-700">
                    {currencySymbol}
                    {Number(item.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
