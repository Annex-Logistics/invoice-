import type { Invoice } from "./types";
import { calcTotals, sumPayments } from "./totals";
import { formatMoney } from "./currencies";
import { docType } from "./docTypes";

// Strip anything the mailto scheme can't carry in an addr-spec,
// including CRLF and separators that could inject extra headers
// (CC, BCC, subject override) into the compose window if the user
// pastes a crafted string into the Bill-To email field.
function sanitizeEmailAddress(raw: string): string {
  return raw.replace(/[\s,;<>"'()\[\]\\]+/g, "").slice(0, 254);
}

export function buildInvoiceMailto(invoice: Invoice): string {
  const totals = calcTotals(invoice);
  const to = sanitizeEmailAddress(invoice.billTo.email || "");
  const cfg = docType(invoice.kind);
  const noun = cfg.label.toLowerCase();
  const subject = `${cfg.label} ${invoice.number} from ${invoice.business.name || "Annex Logistics"}`;

  const lines: string[] = [];
  if (invoice.billTo.name) lines.push(`Hi ${invoice.billTo.name.split(/\s+/)[0]},`);
  else lines.push("Hello,");
  lines.push("");
  lines.push(`Please find the details for ${noun} ${invoice.number} below.`);
  lines.push("");
  lines.push(`${cfg.dueLabel ? "Issue date" : "Date"}: ${invoice.issueDate}`);
  if (cfg.dueLabel) {
    lines.push(`${cfg.dueLabel === "Due" ? "Due date" : cfg.dueLabel}: ${invoice.dueDate}`);
  }
  if (invoice.sourceNumber) lines.push(`Invoice: ${invoice.sourceNumber}`);
  if (cfg.prices) lines.push(`Total: ${formatMoney(totals.total, invoice.currency)}`);
  const paid = cfg.payments ? sumPayments(invoice) : 0;
  if (paid > 0) {
    lines.push(`Amount paid: ${formatMoney(paid, invoice.currency)}`);
    lines.push(`Balance due: ${formatMoney(totals.balanceDue, invoice.currency)}`);
  }
  lines.push("");
  lines.push("Line items:");
  invoice.items.forEach((item) => {
    const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    const what = `  • ${item.description || "—"} — ${item.quantity}`;
    lines.push(
      cfg.prices
        ? `${what} × ${formatMoney(item.rate, invoice.currency)} = ${formatMoney(amount, invoice.currency)}`
        : what
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
