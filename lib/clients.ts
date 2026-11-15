import type { Client, Invoice } from "./types";

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();

// Which saved client a document belongs to. The stored clientId wins;
// documents created before clientId existed (or whose client was
// deleted) fall back to matching the bill-to email, then the name.
export function matchClient(doc: Invoice, clients: Client[]): Client | undefined {
  if (doc.clientId) {
    const byId = clients.find((c) => c.id === doc.clientId);
    if (byId) return byId;
  }
  const email = norm(doc.billTo.email);
  if (email) {
    const byEmail = clients.find((c) => norm(c.email) === email);
    if (byEmail) return byEmail;
  }
  const name = norm(doc.billTo.name);
  if (name) return clients.find((c) => norm(c.name) === name);
  return undefined;
}
