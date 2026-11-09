import type { Invoice } from "./types";
import { calcTotals } from "./totals";
import { formatMoney } from "./currencies";

export function buildInvoiceMailto(invoice: Invoice): string {
  const totals = calcTotals(invoice);
  const to = invoice.billTo.email || "";
  const subject = `Invoice ${invoice.number} from ${invoice.business.name || "Annex Logistics"}`;

  const lines: string[] = [];
  if (invoice.billTo.name) lines.push(`Hi ${invoice.billTo.name.split(/\s+/)[0]},`);
  else lines.push("Hello,");
  lines.push("");
  lines.push(`Please find the details for invoice ${invoice.number} below.`);
  lines.push("");
  lines.push(`Issue date: ${invoice.issueDate}`);
  lines.push(`Due date:   ${invoice.dueDate}`);
  lines.push(`Total:      ${formatMoney(totals.total, invoice.currency)}`);
  if (invoice.amountPaid > 0) {
    lines.push(`Amount paid: ${formatMoney(invoice.amountPaid, invoice.currency)}`);
    lines.push(`Balance due: ${formatMoney(totals.balanceDue, invoice.currency)}`);
  }
  lines.push("");
  lines.push("Line items:");
  invoice.items.forEach((item) => {
    const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    lines.push(
      `  • ${item.description || "—"} — ${item.quantity} × ${formatMoney(item.rate, invoice.currency)} = ${formatMoney(amount, invoice.currency)}`
    );
  });
  if (invoice.notes) {
    lines.push("");
    lines.push(invoice.notes);
  }
  lines.push("");
  lines.push(`Thank you,`);
  lines.push(invoice.business.name || "Annex Logistics");

  const body = lines.join("\n");

  // Per RFC 6068, the mailto `to` is an addr-spec: do NOT percent-encode
  // the `@`. Mail clients (Outlook especially) reject `user%40host`.
  const params = new URLSearchParams({ subject, body });
  // URLSearchParams encodes spaces as `+`; mailto expects `%20`.
  const q = params.toString().replace(/\+/g, "%20");
  return `mailto:${to}?${q}`;
}
