"use client";

import type { Invoice } from "./types";
import { calcTotals } from "./totals";
import { formatMoney } from "./currencies";

/**
 * Generates a PDF from an invoice using jsPDF directly
 * (clean, text-first rendering — no html2canvas needed).
 */
export async function exportInvoicePdf(invoice: Invoice) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  const totals = calcTotals(invoice);

  const BRAND = [24, 102, 234] as [number, number, number];
  const INK   = [31, 35, 44] as [number, number, number];
  const MUTED = [99, 110, 130] as [number, number, number];
  const RULE  = [213, 217, 224] as [number, number, number];

  doc.setFont("helvetica", "normal");

  // Header band
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 8, "F");

  // Top: business + INVOICE title
  let y = margin + 8;
  let textX = margin;

  // Render logo if present
  if (invoice.business.logoDataUrl) {
    try {
      const mimeMatch = /^data:image\/(png|jpeg|jpg|gif);base64,/i.exec(invoice.business.logoDataUrl);
      if (mimeMatch) {
        const fmt = mimeMatch[1].toUpperCase() === "JPG" ? "JPEG" : mimeMatch[1].toUpperCase();
        const logoSize = 56;
        doc.addImage(invoice.business.logoDataUrl, fmt, margin, y - 14, logoSize, logoSize, undefined, "FAST");
        textX = margin + logoSize + 14;
      }
    } catch {
      // ignore unsupported images
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(invoice.business.name || "Your business", textX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const bizLines = [
    invoice.business.address,
    invoice.business.email,
    invoice.business.phone,
    invoice.business.website,
  ].filter(Boolean);
  let by = y + 16;
  bizLines.forEach((line) => {
    doc.text(line as string, textX, by);
    by += 13;
  });
  // Ensure header row has at least the logo's height
  if (invoice.business.logoDataUrl) {
    by = Math.max(by, y + 56);
  }

  // Right side — big INVOICE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(...BRAND);
  const title = "INVOICE";
  const titleW = doc.getTextWidth(title);
  doc.text(title, pageW - margin - titleW, y);

  // Invoice meta
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const metaRows = [
    ["Invoice #", invoice.number],
    ["Issue Date", invoice.issueDate],
    ["Due Date",  invoice.dueDate],
  ];
  if (invoice.poNumber) metaRows.push(["PO Number", invoice.poNumber]);
  let my = y + 18;
  metaRows.forEach(([k, v]) => {
    doc.setTextColor(...MUTED);
    const label = `${k}:`;
    const labelW = doc.getTextWidth(label);
    doc.text(label, pageW - margin - 140, my);
    doc.setTextColor(...INK);
    doc.text(String(v || "—"), pageW - margin - 140 + labelW + 6, my);
    my += 14;
  });

  y = Math.max(by, my) + 20;

  // Bill To / Ship To
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Bill To", margin, y);

  const hasShip = !!(invoice.shipTo && (invoice.shipTo.name || invoice.shipTo.address));
  if (hasShip) {
    doc.text("Ship To", margin + (pageW - margin * 2) / 2, y);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const billLines = [
    invoice.billTo.name,
    invoice.billTo.address,
    invoice.billTo.email,
    invoice.billTo.phone,
  ].filter(Boolean) as string[];

  let ty = y + 16;
  billLines.forEach((line) => {
    doc.text(line, margin, ty);
    ty += 13;
  });

  if (hasShip) {
    const shipX = margin + (pageW - margin * 2) / 2;
    const shipLines = [
      invoice.shipTo!.name,
      invoice.shipTo!.address,
      invoice.shipTo!.email,
      invoice.shipTo!.phone,
    ].filter(Boolean) as string[];
    let sy = y + 16;
    shipLines.forEach((line) => {
      doc.text(line, shipX, sy);
      sy += 13;
    });
    ty = Math.max(ty, sy);
  }

  y = ty + 14;

  // Items table
  const tableTop = y;
  const colDesc = margin;
  const colQty  = pageW - margin - 300;
  const colRate = pageW - margin - 190;
  const colAmt  = pageW - margin - 80;

  doc.setFillColor(243, 245, 250);
  doc.rect(margin, tableTop, pageW - margin * 2, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("Description", colDesc + 8, tableTop + 16);
  doc.text("Qty",  colQty,  tableTop + 16, { align: "right" });
  doc.text("Rate", colRate, tableTop + 16, { align: "right" });
  doc.text("Amount", pageW - margin - 8, tableTop + 16, { align: "right" });

  y = tableTop + 28;
  doc.setFont("helvetica", "normal");

  const FOOTER_RESERVE = 40; // leave room for the page footer text

  function ensureSpace(h: number) {
    if (y + h > pageH - margin - FOOTER_RESERVE) {
      doc.addPage();
      y = margin;
    }
  }

  for (const item of invoice.items) {
    const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    const descLines = doc.splitTextToSize(item.description || "—", colQty - colDesc - 16);
    const rowH = Math.max(18, descLines.length * 13 + 6);

    ensureSpace(rowH + 6);

    doc.setTextColor(...INK);
    doc.text(descLines, colDesc + 8, y + 12);
    doc.text(String(item.quantity ?? 0), colQty, y + 12, { align: "right" });
    doc.text(formatMoney(item.rate, invoice.currency),   colRate, y + 12, { align: "right" });
    doc.text(formatMoney(amount, invoice.currency),       pageW - margin - 8, y + 12, { align: "right" });

    y += rowH;
    doc.setDrawColor(...RULE);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  }

  // Totals
  y += 10;
  const totalsX = pageW - margin - 240;
  const valueX  = pageW - margin - 8;

  const rows: Array<[string, string, boolean?]> = [
    ["Subtotal", formatMoney(totals.subtotal, invoice.currency)],
  ];
  if (totals.discount > 0) {
    const label = invoice.discountLabel + (invoice.discountMode === "percent" ? ` (${invoice.discountValue}%)` : "");
    rows.push([label, `- ${formatMoney(totals.discount, invoice.currency)}`]);
  }
  if (totals.tax > 0) {
    const label = invoice.taxLabel + (invoice.taxMode === "percent" ? ` (${invoice.taxValue}%)` : "");
    rows.push([label, formatMoney(totals.tax, invoice.currency)]);
  }
  if (totals.shipping > 0) {
    rows.push(["Shipping", formatMoney(totals.shipping, invoice.currency)]);
  }
  rows.push(["Total", formatMoney(totals.total, invoice.currency), true]);
  if (invoice.amountPaid > 0) {
    rows.push(["Amount Paid", `- ${formatMoney(invoice.amountPaid, invoice.currency)}`]);
    rows.push(["Balance Due", formatMoney(totals.balanceDue, invoice.currency), true]);
  }

  // Keep the totals block together on one page when possible.
  const totalsHeight = rows.reduce((h, r) => h + 16 + (r[2] ? 6 : 0), 0);
  ensureSpace(totalsHeight);

  doc.setFontSize(10);
  rows.forEach(([k, v, bold]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...(bold ? BRAND : INK));
    doc.text(k, totalsX, y + 12);
    doc.text(v, valueX, y + 12, { align: "right" });
    y += 16;
    if (bold) {
      doc.setDrawColor(...RULE);
      doc.line(totalsX, y, valueX, y);
      y += 6;
    }
  });

  // Notes / Terms
  y += 20;
  if (invoice.notes || invoice.terms) {
    ensureSpace(24);
    doc.setDrawColor(...RULE);
    doc.line(margin, y, pageW - margin, y);
    y += 16;
  }

  function renderParagraph(heading: string, text: string) {
    const bodyLines = doc.splitTextToSize(text, pageW - margin * 2);
    const blockHeight = 14 + bodyLines.length * 12 + 10;
    ensureSpace(blockHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(heading, margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(bodyLines, margin, y);
    y += bodyLines.length * 12 + 10;
  }

  if (invoice.notes) renderParagraph("Notes", invoice.notes);
  if (invoice.terms) renderParagraph("Terms", invoice.terms);

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const footer = `AnnexInvoice — ${invoice.business.name || "Annex Logistics"}`;
    doc.text(footer, margin, pageH - 24);
    if (totalPages > 1) {
      doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 24, { align: "right" });
    }
  }

  doc.save(safeFilename(invoice.number) + ".pdf");
}

// Keep the filename safe across OSes; invoice numbers like "INV/2026"
// or "INV:01" would otherwise fail or create unexpected subdirectories.
function safeFilename(raw: string | undefined): string {
  const base = (raw || "invoice")
    .replace(/[\\/:*?"<>|\u0000-\u001F]+/g, "-")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 80);
  return base || "invoice";
}
