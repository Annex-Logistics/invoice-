import type { Invoice } from "../../lib/types";
import { DEFAULT_CURRENCY } from "../../lib/currencies";

// A minimal, valid invoice for pure-function tests. Override any field.
export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    kind: "invoice",
    number: "INV-0001",
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    issueDate: "2026-01-01",
    dueDate: "2026-01-15",
    business: { name: "Annex Logistics", email: "", phone: "", address: "", website: "" },
    billTo: { name: "Ada Obi", email: "ada@example.com", phone: "", address: "" },
    items: [{ id: "l1", description: "Delivery", quantity: 2, rate: 100 }],
    currency: DEFAULT_CURRENCY,
    taxLabel: "Tax",
    taxMode: "percent",
    taxValue: 0,
    discountLabel: "Discount",
    discountMode: "percent",
    discountValue: 0,
    shipping: 0,
    notes: "",
    terms: "",
    amountPaid: 0,
    ...overrides,
  };
}
