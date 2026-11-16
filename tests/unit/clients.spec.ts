import { test, expect } from "@playwright/test";
import { matchClient } from "../../lib/clients";
import { parseBackup } from "../../lib/import";
import { makeInvoice } from "./fixtures";

const ada = { id: "c-ada", name: "Ada Obi", email: "ada@example.com", phone: "", address: "" };
const ben = { id: "c-ben", name: "Ben Eze", email: "ben@example.com", phone: "", address: "" };

test("clientId wins over a bill-to that now matches someone else", () => {
  const inv = makeInvoice({
    clientId: "c-ada",
    billTo: { name: "Ben Eze", email: "ben@example.com", phone: "", address: "" },
  });
  expect(matchClient(inv, [ada, ben])?.id).toBe("c-ada");
});

test("attribution survives the client being renamed", () => {
  const inv = makeInvoice({ clientId: "c-ada" });
  const renamed = { ...ada, name: "Ada Obi-Nwosu", email: "ada@newmail.com" };
  expect(matchClient(inv, [renamed])?.id).toBe("c-ada");
});

test("legacy documents fall back to email, then name, case-insensitively", () => {
  const byEmail = makeInvoice({ billTo: { name: "x", email: " BEN@example.com ", phone: "", address: "" } });
  const byName = makeInvoice({ billTo: { name: "ada obi", email: "", phone: "", address: "" } });
  expect(matchClient(byEmail, [ada, ben])?.id).toBe("c-ben");
  expect(matchClient(byName, [ada, ben])?.id).toBe("c-ada");
});

test("a deleted client falls back to the heuristic, or no match", () => {
  const inv = makeInvoice({ clientId: "gone", billTo: { name: "Nobody", email: "", phone: "", address: "" } });
  expect(matchClient(inv, [ada, ben])).toBeUndefined();
});

test("clientId survives a backup round-trip", () => {
  const result = parseBackup(JSON.stringify({ invoices: [makeInvoice({ clientId: "c-ada" })] }));
  expect(result.invoices?.[0].clientId).toBe("c-ada");
});
