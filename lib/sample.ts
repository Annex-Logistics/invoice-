import type { Invoice } from "./types";
import { DEFAULT_CURRENCY } from "./currencies";
import { createId, addDaysISO, todayISO } from "./storage";

export function sampleInvoices(): Invoice[] {
  const today = todayISO();
  const business = {
    name: "Annex Logistics",
    email: "billing@annex.logistics",
    phone: "+1 (415) 555-0199",
    address: "244 Harbor Way\nSuite 400\nSan Francisco, CA 94111",
    website: "annex.logistics",
    logoDataUrl: undefined,
  };

  const mk = (opts: {
    number: string;
    client: { name: string; email: string; address: string };
    items: Array<{ description: string; quantity: number; rate: number }>;
    status: Invoice["status"];
    dueOffset: number;
    taxValue?: number;
    discountValue?: number;
    shipping?: number;
    amountPaid?: number;
  }): Invoice => ({
    id: createId(),
    number: opts.number,
    status: opts.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    issueDate: today,
    dueDate: addDaysISO(today, opts.dueOffset),
    poNumber: "",
    business,
    billTo: { ...opts.client, phone: "" },
    shipTo: { name: "", email: "", address: "", phone: "" },
    items: opts.items.map((it) => ({ id: createId(), ...it })),
    currency: DEFAULT_CURRENCY,
    taxLabel: "Sales tax",
    taxMode: "percent",
    taxValue: opts.taxValue ?? 7.25,
    discountLabel: "Discount",
    discountMode: "percent",
    discountValue: opts.discountValue ?? 0,
    shipping: opts.shipping ?? 0,
    notes: "Thanks for your business — we appreciate the partnership.",
    terms: "Payment due within 14 days of the issue date.",
    amountPaid: opts.amountPaid ?? 0,
  });

  return [
    mk({
      number: "INV-0003",
      client: {
        name: "Harbor & Finch Co.",
        email: "ap@harborfinch.example",
        address: "88 Cannery Row\nMonterey, CA 93940",
      },
      items: [
        { description: "Last-mile freight — Bay Area route (Oct)", quantity: 12, rate: 185 },
        { description: "Pallet handling fee",                       quantity: 4,  rate: 45  },
      ],
      status: "sent",
      dueOffset: 10,
    }),
    mk({
      number: "INV-0002",
      client: {
        name: "Meridian Coffee Roasters",
        email: "finance@meridiancoffee.example",
        address: "1200 West Burnside\nPortland, OR 97209",
      },
      items: [
        { description: "Refrigerated transport — 2 shipments", quantity: 2, rate: 640 },
        { description: "Expedited delivery surcharge",          quantity: 1, rate: 120 },
      ],
      status: "paid",
      dueOffset: -5,
      amountPaid: 1400,
    }),
    mk({
      number: "INV-0001",
      client: {
        name: "Oak & Iron Furniture",
        email: "hello@oakandiron.example",
        address: "501 Industrial Blvd\nAustin, TX 78702",
      },
      items: [
        { description: "Containerized freight (LCL) — Austin → Denver", quantity: 1, rate: 1850 },
        { description: "Load inspection and crating",                    quantity: 3, rate: 95 },
      ],
      status: "overdue",
      dueOffset: -8,
      discountValue: 5,
    }),
  ];
}
