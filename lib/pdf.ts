"use client";

import type { Invoice } from "./types";
import { calcTotals, sumPayments } from "./totals";
import { formatMoney } from "./currencies";
import { docType } from "./docTypes";

// Inter, embedded so the PDF matches the on-screen preview and can draw
// any character the app can show. jsPDF's built-in Helvetica only covers
// Windows-1252: the Naira sign came out as a broken bar with stretched
// digits, and names like "Chịdị" were garbled.
// The TTFs (public/fonts, ~340 KB each) are fetched only on first export
// and kept for the session.
const FONT_FILES = [
  { file: "Inter-Regular.ttf", style: "normal" },
  { file: "Inter-Bold.ttf", style: "bold" },
] as const;

let fontCache: Promise<string[]> | null = null;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000; // keep String.fromCharCode's argument list small
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function loadFonts(): Promise<string[]> {
  if (!fontCache) {
    fontCache = Promise.all(
      FONT_FILES.map(async ({ file }) => {
        const res = await fetch(`/fonts/${file}`);
        if (!res.ok) throw new Error(`Font ${file}: HTTP ${res.status}`);
        return toBase64(new Uint8Array(await res.arrayBuffer()));
      })
    );
    // Don't cache a failure: the next export should try again.
    fontCache.catch(() => {
      fontCache = null;
    });
  }
  return fontCache;
}

/**
 * Generates a PDF from an invoice using jsPDF directly
 * (clean, text-first rendering — no html2canvas needed).
 */
export async function exportInvoicePdf(invoice: Invoice) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "pt", format: "letter" });

  // Fall back to Helvetica if the fonts can't be fetched (offline), so
  // export still works for plain Latin text.
  let FONT = "helvetica";
  try {
    const data = await loadFonts();
    FONT_FILES.forEach(({ file, style }, i) => {
      doc.addFileToVFS(file, data[i]);
      doc.addFont(file, "Inter", style);
    });
    FONT = "Inter";
  } catch (err) {
    console.warn("[AnnexInvoice] PDF fonts unavailable, using Helvetica", err);
  }
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;

  const totals = calcTotals(invoice);

  const BRAND = [24, 102, 234] as [number, number, number];
  const INK   = [31, 35, 44] as [number, number, number];
  const MUTED = [99, 110, 130] as [number, number, number];
  const RULE  = [213, 217, 224] as [number, number, number];

  doc.setFont(FONT, "normal");

  // Draw text blocks that may contain newlines (addresses) or be too
  // wide: every entry is split on line breaks and wrapped to maxWidth.
  // Returns the y after the last line. (Previously each entry advanced
  // y by one line only, so a 3-line address overprinted what followed.)
  function drawLines(entries: string[], x: number, startY: number, lineH: number, maxWidth: number): number {
    let cy = startY;
    for (const entry of entries) {
      for (const raw of String(entry).split(/\r?\n/)) {
        const wrapped: string[] = raw.trim() ? doc.splitTextToSize(raw, maxWidth) : [];
        for (const line of wrapped) {
          doc.text(line, x, cy);
          cy += lineH;
        }
      }
    }
    return cy;
  }

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

  // The right 220pt of the header belongs to the title and meta block.
  const headerLeftW = pageW - margin - 220 - textX;
  doc.setFont(FONT, "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  let by = drawLines([invoice.business.name || "Your business"], textX, y, 23, headerLeftW) - 23 + 16;

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const bizLines = [
    invoice.business.address,
    invoice.business.email,
    invoice.business.phone,
    invoice.business.website,
  ].filter(Boolean) as string[];
  by = drawLines(bizLines, textX, by, 13, headerLeftW);
  // Ensure header row has at least the logo's height
  if (invoice.business.logoDataUrl) {
    by = Math.max(by, y + 56);
  }

  // Right side — big INVOICE / ESTIMATE
  const cfg = docType(invoice.kind);
  const docLabel = cfg.label;
  doc.setFont(FONT, "bold");
  // Longer titles ("DELIVERY NOTE") get a smaller size so they never
  // run into the business name on the left.
  const title = cfg.title;
  doc.setFontSize(title.length > 8 ? 24 : 34);
  doc.setTextColor(...BRAND);
  const titleW = doc.getTextWidth(title);
  doc.text(title, pageW - margin - titleW, y);

  // Document meta
  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const metaRows: Array<[string, string]> = [
    [`${docLabel} #`, invoice.number],
    [cfg.dueLabel ? "Issue Date" : "Date", invoice.issueDate],
  ];
  if (cfg.dueLabel) metaRows.push([cfg.dueLabel === "Due" ? "Due Date" : cfg.dueLabel, invoice.dueDate]);
  if (invoice.sourceNumber) metaRows.push(["Invoice #", invoice.sourceNumber]);
  if (invoice.poNumber) metaRows.push(["PO Number", invoice.poNumber]);
  let my = y + 18;
  metaRows.forEach(([k, v]) => {
    doc.setTextColor(...MUTED);
    doc.text(`${k}:`, pageW - margin - 190, my);
    doc.setTextColor(...INK);
    doc.text(String(v || "—"), pageW - margin, my, { align: "right" });
    my += 14;
  });

  y = Math.max(by, my) + 20;

  // Bill To / Ship To
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  doc.setFont(FONT, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(cfg.partyLabel, margin, y);

  const hasShip = !!(invoice.shipTo && (invoice.shipTo.name || invoice.shipTo.address));
  if (hasShip) {
    doc.text("Ship To", margin + (pageW - margin * 2) / 2, y);
  }

  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const billLines = [
    invoice.billTo.name,
    invoice.billTo.address,
    invoice.billTo.email,
    invoice.billTo.phone,
  ].filter(Boolean) as string[];

  const partyW = (pageW - margin * 2) / 2 - 16;
  let ty = drawLines(billLines, margin, y + 16, 13, hasShip ? partyW : pageW - margin * 2);

  if (hasShip) {
    const shipX = margin + (pageW - margin * 2) / 2;
    const shipLines = [
      invoice.shipTo!.name,
      invoice.shipTo!.address,
      invoice.shipTo!.email,
      invoice.shipTo!.phone,
    ].filter(Boolean) as string[];
    ty = Math.max(ty, drawLines(shipLines, shipX, y + 16, 13, partyW));
  }

  y = ty + 14;

  // Items table
  const tableTop = y;
  const colDesc = margin;
  // Without prices the quantity sits at the right edge.
  const colQty  = cfg.prices ? pageW - margin - 250 : pageW - margin - 8;
  const colRate = pageW - margin - 140;

  doc.setFillColor(243, 245, 250);
  doc.rect(margin, tableTop, pageW - margin * 2, 24, "F");
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("Description", colDesc + 8, tableTop + 16);
  doc.text("Qty",  colQty,  tableTop + 16, { align: "right" });
  if (cfg.prices) {
    doc.text("Rate", colRate, tableTop + 16, { align: "right" });
    doc.text("Amount", pageW - margin - 8, tableTop + 16, { align: "right" });
  }

  y = tableTop + 28;
  doc.setFont(FONT, "normal");

  const FOOTER_RESERVE = 40; // leave room for the page footer text

  function ensureSpace(h: number) {
    if (y + h > pageH - margin - FOOTER_RESERVE) {
      doc.addPage();
      y = margin;
    }
  }

  for (const item of invoice.items) {
    const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
    const descLines = doc.splitTextToSize(
      item.description || "—",
      colQty - colDesc - 60
    );
    const rowH = Math.max(18, descLines.length * 13 + 6);

    ensureSpace(rowH + 6);

    doc.setTextColor(...INK);
    doc.text(descLines, colDesc + 8, y + 12);
    doc.text(String(item.quantity ?? 0), colQty, y + 12, { align: "right" });
    if (cfg.prices) {
      doc.text(formatMoney(item.rate, invoice.currency),   colRate, y + 12, { align: "right" });
      doc.text(formatMoney(amount, invoice.currency),       pageW - margin - 8, y + 12, { align: "right" });
    }

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
  const paidTotal = sumPayments(invoice);
  if (cfg.payments && paidTotal > 0) {
    rows.push(["Amount Paid", `- ${formatMoney(paidTotal, invoice.currency)}`]);
    rows.push(["Balance Due", formatMoney(totals.balanceDue, invoice.currency), true]);
  }

  // Keep the totals block together on one page when possible.
  const totalsHeight = rows.reduce((h, r) => h + 16 + (r[2] ? 6 : 0), 0);
  ensureSpace(totalsHeight);

  doc.setFontSize(10);
  (cfg.prices ? rows : []).forEach(([k, v, bold]) => {
    doc.setFont(FONT, bold ? "bold" : "normal");
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
    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(heading, margin, y);
    y += 14;
    doc.setFont(FONT, "normal");
    doc.setTextColor(...MUTED);
    doc.text(bodyLines, margin, y);
    y += bodyLines.length * 12 + 10;
  }

  if (invoice.notes) renderParagraph("Notes", invoice.notes);
  if (invoice.terms) renderParagraph("Terms", invoice.terms);

  // Payments received (invoices only)
  if (cfg.payments && Array.isArray(invoice.payments) && invoice.payments.length > 0) {
    const headerH = 18;
    const rowH = 14;
    const blockH = headerH + invoice.payments.length * rowH + 6;
    ensureSpace(blockH);

    doc.setFont(FONT, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text("Payments received", margin, y);
    y += 12;

    doc.setFillColor(243, 245, 250);
    doc.rect(margin, y, pageW - margin * 2, headerH, "F");
    doc.setFontSize(9);
    doc.text("Date",   margin + 8, y + 12);
    doc.text("Method", margin + 100, y + 12);
    doc.text("Note",   margin + 220, y + 12);
    doc.text("Amount", pageW - margin - 8, y + 12, { align: "right" });
    y += headerH;

    doc.setFont(FONT, "normal");
    for (const p of invoice.payments) {
      doc.setTextColor(...INK);
      doc.text(p.date || "—", margin + 8, y + 11);
      doc.text((p.method || "other").replace("-", " "), margin + 100, y + 11);
      const noteLine = doc.splitTextToSize(p.note || "", 220)[0] || "";
      doc.text(noteLine, margin + 220, y + 11);
      doc.text(formatMoney(p.amount, invoice.currency), pageW - margin - 8, y + 11, { align: "right" });
      y += rowH;
      doc.setDrawColor(...RULE);
      doc.line(margin, y, pageW - margin, y);
    }
  }

  // Signature lines (delivery notes)
  if (cfg.signature) {
    ensureSpace(70);
    y += 44;
    const half = (pageW - margin * 2 - 32) / 2;
    doc.setDrawColor(...RULE);
    doc.line(margin, y, margin + half, y);
    doc.line(margin + half + 32, y, pageW - margin, y);
    doc.setFont(FONT, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Received by (name and signature)", margin, y + 12);
    doc.text("Date received", margin + half + 32, y + 12);
    y += 20;
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont(FONT, "normal");
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
