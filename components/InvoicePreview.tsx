"use client";

import type { Invoice } from "@/lib/types";
import { calcTotals } from "@/lib/totals";
import { formatMoney } from "@/lib/currencies";

export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const totals = calcTotals(invoice);
  const hasShip = !!(invoice.shipTo && (invoice.shipTo.name || invoice.shipTo.address));

  return (
    <div className="print-page mx-auto max-w-[8.5in] bg-white p-8 text-ink-900">
      <div className="mb-6 h-1 w-full rounded-full bg-brand-600" />

      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          {invoice.business.logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={invoice.business.logoDataUrl}
              alt="Logo"
              className="h-16 w-16 rounded-md object-contain"
            />
          )}
          <div>
            <div className="text-xl font-bold">{invoice.business.name || "Your business"}</div>
            <div className="mt-1 whitespace-pre-line text-xs text-ink-500">
              {[invoice.business.address, invoice.business.email, invoice.business.phone, invoice.business.website]
                .filter(Boolean)
                .join("\n")}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold tracking-tight text-brand-700">INVOICE</div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-ink-500">Invoice #</dt><dd className="font-medium">{invoice.number}</dd>
            <dt className="text-ink-500">Issue</dt><dd className="font-medium">{invoice.issueDate}</dd>
            <dt className="text-ink-500">Due</dt><dd className="font-medium">{invoice.dueDate}</dd>
            {invoice.poNumber && (<><dt className="text-ink-500">PO</dt><dd className="font-medium">{invoice.poNumber}</dd></>)}
          </dl>
        </div>
      </div>

      <hr className="my-6 border-ink-100" />

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Bill To</div>
          <div className="text-sm font-semibold">{invoice.billTo.name || "—"}</div>
          <div className="whitespace-pre-line text-xs text-ink-600">{invoice.billTo.address}</div>
          <div className="text-xs text-ink-600">{invoice.billTo.email}</div>
          <div className="text-xs text-ink-600">{invoice.billTo.phone}</div>
        </div>
        {hasShip && (
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Ship To</div>
            <div className="text-sm font-semibold">{invoice.shipTo?.name || "—"}</div>
            <div className="whitespace-pre-line text-xs text-ink-600">{invoice.shipTo?.address}</div>
            <div className="text-xs text-ink-600">{invoice.shipTo?.email}</div>
            <div className="text-xs text-ink-600">{invoice.shipTo?.phone}</div>
          </div>
        )}
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-ink-50 text-left text-[10px] uppercase tracking-wider text-ink-500">
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Rate</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => {
            const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
            return (
              <tr key={item.id} className="border-b border-ink-100 align-top">
                <td className="px-3 py-3">{item.description || <span className="text-ink-300">—</span>}</td>
                <td className="px-3 py-3 text-right">{item.quantity}</td>
                <td className="px-3 py-3 text-right">{formatMoney(item.rate, invoice.currency)}</td>
                <td className="px-3 py-3 text-right font-medium">{formatMoney(amount, invoice.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs">
          <Row label="Subtotal" value={formatMoney(totals.subtotal, invoice.currency)} />
          {totals.discount > 0 && (
            <Row
              label={`${invoice.discountLabel}${invoice.discountMode === "percent" ? ` (${invoice.discountValue}%)` : ""}`}
              value={`- ${formatMoney(totals.discount, invoice.currency)}`}
            />
          )}
          {totals.tax > 0 && (
            <Row
              label={`${invoice.taxLabel}${invoice.taxMode === "percent" ? ` (${invoice.taxValue}%)` : ""}`}
              value={formatMoney(totals.tax, invoice.currency)}
            />
          )}
          {totals.shipping > 0 && (
            <Row label="Shipping" value={formatMoney(totals.shipping, invoice.currency)} />
          )}
          <div className="my-2 border-t border-ink-200" />
          <Row label="Total" value={formatMoney(totals.total, invoice.currency)} bold />
          {invoice.amountPaid > 0 && (
            <>
              <Row label="Amount paid" value={`- ${formatMoney(invoice.amountPaid, invoice.currency)}`} />
              <div className="my-2 border-t border-ink-200" />
              <div className="flex items-baseline justify-between rounded-md bg-brand-50 px-3 py-2">
                <span className="text-sm font-semibold text-brand-900">Balance due</span>
                <span className="text-lg font-bold text-brand-700">
                  {formatMoney(totals.balanceDue, invoice.currency)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {(invoice.notes || invoice.terms) && (
        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-ink-100 pt-4">
          {invoice.notes && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Notes</div>
              <p className="whitespace-pre-line text-xs text-ink-600">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Terms</div>
              <p className="whitespace-pre-line text-xs text-ink-600">{invoice.terms}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-10 border-t border-ink-100 pt-3 text-center text-[10px] uppercase tracking-wider text-ink-400">
        AnnexInvoice — {invoice.business.name || "Annex Logistics"}
      </div>
    </div>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className={bold ? "text-sm font-semibold text-ink-900" : "text-sm text-ink-600"}>{label}</span>
      <span className={bold ? "text-base font-bold text-ink-900" : "text-sm font-medium text-ink-900"}>{value}</span>
    </div>
  );
}
