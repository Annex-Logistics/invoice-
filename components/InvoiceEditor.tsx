"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import type {
  Invoice,
  LineItem,
  Party,
  Business,
  InvoiceStatus,
} from "@/lib/types";
import { CURRENCIES, findCurrency, formatMoney } from "@/lib/currencies";
import {
  duplicateInvoice,
  removeInvoice,
  saveBusiness,
  upsertInvoice,
} from "@/lib/storage";
import { calcTotals } from "@/lib/totals";
import { exportInvoicePdf } from "@/lib/pdf";
import { LineItemsTable } from "./LineItemsTable";
import { LogoUpload } from "./LogoUpload";
import { InvoicePreview } from "./InvoicePreview";
import { StatusBadge } from "./StatusBadge";

type Props = {
  initialInvoice: Invoice;
  isNew?: boolean;
};

const STATUS_OPTIONS: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];

export function InvoiceEditor({ initialInvoice, isNew = false }: Props) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  const [showPreview, setShowPreview] = useState(false);
  const [showShipTo, setShowShipTo] = useState(
    !!(initialInvoice.shipTo && (initialInvoice.shipTo.name || initialInvoice.shipTo.address))
  );
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");

  const totals = useMemo(() => calcTotals(invoice), [invoice]);

  // Auto-save (debounced)
  useEffect(() => {
    setSaved("saving");
    const t = setTimeout(() => {
      upsertInvoice(invoice);
      saveBusiness(invoice.business);
      setSaved("saved");
      const hide = setTimeout(() => setSaved("idle"), 1200);
      return () => clearTimeout(hide);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice]);

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
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    removeInvoice(invoice.id);
    router.push("/invoices");
  }

  async function handleDownload() {
    await exportInvoicePdf(invoice);
  }

  function handleMarkSent() {
    patch("status", "sent");
  }

  function handleDuplicate() {
    upsertInvoice(invoice);
    const copy = duplicateInvoice(invoice.id);
    if (copy) router.push(`/invoices/${copy.id}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/invoices" className="btn-ghost -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-ink-900">
                {isNew ? "New invoice" : `Edit ${invoice.number}`}
              </h1>
              <StatusBadge status={invoice.status} />
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
          <button className="btn-primary" onClick={handleMarkSent}>
            <Send className="h-4 w-4" /> Mark as sent
          </button>
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
                  value={invoice.business.name}
                  onChange={(e) => patchBusiness({ name: e.target.value })}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="field-ghost" placeholder="Email"
                    value={invoice.business.email}
                    onChange={(e) => patchBusiness({ email: e.target.value })} />
                  <input className="field-ghost" placeholder="Phone"
                    value={invoice.business.phone}
                    onChange={(e) => patchBusiness({ phone: e.target.value })} />
                </div>
                <textarea
                  rows={2}
                  className="field-ghost resize-none"
                  placeholder="Business address"
                  value={invoice.business.address}
                  onChange={(e) => patchBusiness({ address: e.target.value })}
                />
                <input className="field-ghost" placeholder="Website"
                  value={invoice.business.website}
                  onChange={(e) => patchBusiness({ website: e.target.value })} />
              </div>

              <div className="space-y-3 md:border-l md:border-ink-100 md:pl-5">
                <div>
                  <label className="label">Invoice #</label>
                  <input className="field"
                    value={invoice.number}
                    onChange={(e) => patch("number", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Issue</label>
                    <input type="date" className="field"
                      value={invoice.issueDate}
                      onChange={(e) => patch("issueDate", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Due</label>
                    <input type="date" className="field"
                      value={invoice.dueDate}
                      onChange={(e) => patch("dueDate", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">PO #</label>
                  <input className="field"
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
                <h3 className="mb-3 text-sm font-semibold text-ink-900">Bill To</h3>
                <div className="space-y-2">
                  <input className="field" placeholder="Client / company name"
                    value={invoice.billTo.name}
                    onChange={(e) => patchBillTo({ name: e.target.value })} />
                  <input className="field" placeholder="Email"
                    value={invoice.billTo.email}
                    onChange={(e) => patchBillTo({ email: e.target.value })} />
                  <input className="field" placeholder="Phone"
                    value={invoice.billTo.phone}
                    onChange={(e) => patchBillTo({ phone: e.target.value })} />
                  <textarea rows={3} className="field resize-none" placeholder="Billing address"
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
                    <input className="field" placeholder="Name"
                      value={invoice.shipTo?.name ?? ""}
                      onChange={(e) => patchShipTo({ name: e.target.value })} />
                    <input className="field" placeholder="Email"
                      value={invoice.shipTo?.email ?? ""}
                      onChange={(e) => patchShipTo({ email: e.target.value })} />
                    <input className="field" placeholder="Phone"
                      value={invoice.shipTo?.phone ?? ""}
                      onChange={(e) => patchShipTo({ phone: e.target.value })} />
                    <textarea rows={3} className="field resize-none" placeholder="Shipping address"
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
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Line items</h3>
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <label htmlFor="currency" className="font-medium">Currency</label>
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
            />
          </section>

          {/* Notes + Totals */}
          <section className="grid gap-5 md:grid-cols-5">
            <div className="md:col-span-3 space-y-4">
              <div>
                <label className="label">Notes</label>
                <textarea
                  rows={3}
                  className="field resize-none"
                  placeholder="Thank you for your business."
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
                  value={invoice.terms}
                  onChange={(e) => patch("terms", e.target.value)}
                />
              </div>
            </div>

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

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-sm text-ink-600">Amount paid</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="field w-[92px] text-right"
                    value={invoice.amountPaid}
                    onChange={(e) => patch("amountPaid", parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="mt-3 flex items-baseline justify-between rounded-md bg-ink-50 px-3 py-2">
                  <span className="text-sm font-semibold text-ink-900">Balance due</span>
                  <span className="text-lg font-bold text-ink-900">
                    {formatMoney(totals.balanceDue, invoice.currency)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Danger */}
          {!isNew && (
            <div className="pt-4">
              <button className="btn-danger" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
                Delete invoice
              </button>
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <div className="card p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Status
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map((s) => {
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
                <button className="btn-primary w-full" onClick={() => upsertInvoice(invoice)}>
                  <Save className="h-4 w-4" /> Save
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {showPreview && (
        <PreviewModal onClose={() => setShowPreview(false)}>
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

function PreviewModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4">
      <div
        className="my-8 w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-900">Invoice preview</h3>
          <button className="btn-ghost -mr-2" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
