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

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

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
};

export type SavedItem = {
  id: string;
  description: string;
  rate: number;
};

export type Invoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  issueDate: string;
  dueDate: string;
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

  amountPaid: number;
};

export type Totals = {
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  balanceDue: number;
};
