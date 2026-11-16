import type { DocumentKind, DocumentStatus } from "./types";

// One place that says how each document type behaves. The editor,
// preview, PDF, lists and storage all read this instead of branching on
// `kind`, so adding a type means adding an entry here plus its routes.
export type DocTypeConfig = {
  kind: DocumentKind;
  label: string;            // "Invoice"
  plural: string;           // "Invoices"
  title: string;            // big heading on the document
  path: string;             // list route
  statuses: DocumentStatus[];
  // Label of the second date (stored in `dueDate`), or null to hide it.
  dueLabel: string | null;
  partyLabel: string;       // heading over the customer block
  payments: boolean;        // record and show payments
  prices: boolean;          // show rates, amounts and totals
  signature: boolean;       // "received by" lines on the document
  defaultPrefix: string;    // numbering prefix
  emptyHint: string;        // empty-list copy
};

export const DOC_TYPES: Record<DocumentKind, DocTypeConfig> = {
  invoice: {
    kind: "invoice",
    label: "Invoice",
    plural: "Invoices",
    title: "INVOICE",
    path: "/invoices",
    statuses: ["draft", "sent", "paid", "overdue"],
    dueLabel: "Due",
    partyLabel: "Bill To",
    payments: true,
    prices: true,
    signature: false,
    defaultPrefix: "INV-",
    emptyHint: "Create your first invoice — your business info stays, so the next one is even faster.",
  },
  estimate: {
    kind: "estimate",
    label: "Estimate",
    plural: "Estimates",
    title: "ESTIMATE",
    path: "/estimates",
    statuses: ["draft", "sent", "accepted", "declined"],
    dueLabel: "Valid until",
    partyLabel: "Bill To",
    payments: false,
    prices: true,
    signature: false,
    defaultPrefix: "EST-",
    emptyHint: "Create a quote to send to a prospect. When they accept it, convert it to an invoice with one click.",
  },
  receipt: {
    kind: "receipt",
    label: "Receipt",
    plural: "Receipts",
    title: "RECEIPT",
    path: "/receipts",
    statuses: ["draft", "issued"],
    dueLabel: null,
    partyLabel: "Received From",
    payments: true,
    prices: true,
    signature: false,
    defaultPrefix: "REC-",
    emptyHint: "Proof of payment for a customer. Open a paid invoice and choose Create receipt, or start a blank one.",
  },
  "delivery-note": {
    kind: "delivery-note",
    label: "Delivery note",
    plural: "Delivery notes",
    title: "DELIVERY NOTE",
    path: "/delivery-notes",
    statuses: ["draft", "sent", "delivered"],
    dueLabel: "Delivery date",
    partyLabel: "Deliver To",
    payments: false,
    prices: false,
    signature: true,
    defaultPrefix: "DN-",
    emptyHint: "Lists what was delivered, without prices, for the recipient to sign. Open an invoice and choose Create delivery note, or start a blank one.",
  },
};

export function docType(kind: DocumentKind | undefined): DocTypeConfig {
  return DOC_TYPES[kind ?? "invoice"] ?? DOC_TYPES.invoice;
}

export const DOCUMENT_KINDS = Object.keys(DOC_TYPES) as DocumentKind[];
