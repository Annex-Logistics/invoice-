export type Currency = {
  code: string;      // e.g. "USD"
  symbol: string;    // e.g. "$"
  name: string;      // e.g. "US Dollar"
};

export type LineItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

export type Party = {
  name: string;
  email: string;
  address: string;
  phone: string;
};

export type DocumentKind = "invoice" | "estimate";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type EstimateStatus = "draft" | "sent" | "accepted" | "declined";
export type DocumentStatus = InvoiceStatus | EstimateStatus;

export type PaymentMethod =
  | "cash"
  | "card"
  | "bank-transfer"
  | "check"
  | "paypal"
  | "stripe"
  | "other";

export type Payment = {
  id: string;
  date: string;         // ISO yyyy-mm-dd
  amount: number;
  method: PaymentMethod;
  note: string;
};

export type DiscountMode = "percent" | "fixed";
export type TaxMode = "percent" | "fixed";

export type Business = {
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  logoDataUrl?: string;
};

export type InvoicePrefs = {
  numberPrefix: string;
  nextNumber: number;
  numberPadding: number;
  defaultTerms: string;
  defaultTaxLabel: string;
  defaultTaxPercent: number;
  defaultCurrencyCode: string;
  defaultDueDays: number;

  // Estimate-specific numbering and defaults. Optional so legacy prefs
  // records load without migration.
  estimateNumberPrefix?: string;
  estimateNextNumber?: number;
  estimateNumberPadding?: number;
  estimateDefaultValidDays?: number;
  estimateDefaultTerms?: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
};

export type SavedItem = {
  id: string;
  description: string;
  rate: number;
};

export type Invoice = {
  id: string;
  kind?: DocumentKind;         // omitted on legacy records = "invoice"
  number: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  issueDate: string;
  dueDate: string;              // for estimates, used as "valid until"
  poNumber?: string;

  business: Business;
  billTo: Party;
  shipTo?: Party;

  items: LineItem[];

  currency: Currency;

  taxLabel: string;
  taxMode: TaxMode;
  taxValue: number;

  discountLabel: string;
  discountMode: DiscountMode;
  discountValue: number;

  shipping: number;

  notes: string;
  terms: string;

  // Legacy single-field; new code reads sum of `payments` and falls
  // back to amountPaid when payments is absent.
  amountPaid: number;
  payments?: Payment[];
};

export type Totals = {
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  balanceDue: number;
};
