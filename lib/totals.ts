import type { Invoice, Totals } from "./types";

export function sumPayments(invoice: Invoice): number {
  if (Array.isArray(invoice.payments) && invoice.payments.length > 0) {
    return invoice.payments.reduce((n, p) => n + (Number(p.amount) || 0), 0);
  }
  return Number(invoice.amountPaid) || 0;
}

export function calcTotals(invoice: Invoice): Totals {
  const subtotal = invoice.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
    0
  );

  const discount =
    invoice.discountMode === "percent"
      ? subtotal * (Number(invoice.discountValue) || 0) / 100
      : Number(invoice.discountValue) || 0;

  const afterDiscount = Math.max(0, subtotal - discount);

  const tax =
    invoice.taxMode === "percent"
      ? afterDiscount * (Number(invoice.taxValue) || 0) / 100
      : Number(invoice.taxValue) || 0;

  const shipping = Number(invoice.shipping) || 0;
  const total = afterDiscount + tax + shipping;
  const amountPaid = sumPayments(invoice);
  const balanceDue = Math.max(0, total - amountPaid);

  return { subtotal, discount, tax, shipping, total, balanceDue };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
