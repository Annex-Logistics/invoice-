# AnnexInvoice — Project Guide for Claude Code

This file is read automatically when you open a session in this repo.
It tells you what the project is, what's built, how it's wired, and
where to pick up.

Repo: https://github.com/Annex-Logistics/invoice- (branch `main`)
Owner: Annex Logistics. (Originally built at `patricku-cpu/invoice`;
moved to the Annex-Logistics org in Nov 2026.)

---

## What this is

A clean, browser-based invoice **and** estimate builder, modelled on
the feature set of app.invoicesimple.com but as an original
implementation — no backend, no login, no telemetry. Everything runs
client-side in Next.js and persists to `localStorage` under the
`annexinvoice.*` key namespace. The design is a brand-blue, Inter-based
dashboard with a left sidebar on desktop and a bottom-nav on mobile.

Two sibling document types share one editor, one preview, and one PDF
exporter:

- **Invoices** — statuses `draft | sent | paid | overdue`, payments
  tracked as an array of `{ date, method, amount, note }` records.
- **Estimates** — statuses `draft | sent | accepted | declined`, due
  date is relabeled "Valid until", no payment UI, and a primary
  **Convert to invoice** action that spawns a fresh `/invoices/[id]`
  from the estimate without destroying the source.

---

## Stack

- **Next.js 16.4** (App Router, Turbopack) + **React 19** + TypeScript
  (strict). Upgraded from 14.2 in Nov 2026 to clear critical
  advisories; 14.x has no patched release.
- **Tailwind CSS 3.4** — tokens defined in `tailwind.config.ts`
  (brand-\* and ink-\* scales)
- **lucide-react** icons
- **jsPDF 4.2** for text-first PDF export — no html2canvas, no
  server-side rendering of the PDF
- **localStorage** for everything, mediated by
  `safeSet()` in `lib/storage.ts` (handles quota-exceeded gracefully)
- Response headers via `proxy.ts` (Next 16's name for middleware;
  nonce CSP, dev-safe) + `next.config.js`
- ESLint 9 flat config in `eslint.config.mjs` (`npm run lint` runs
  `eslint .`; `next lint` no longer exists in Next 16)
- Dependabot weekly + GitHub Actions CI (`npm run lint`, `npm run
  build`, `npm audit --audit-level=high`)

Node 22 for CI; 20 or newer should work locally.

---

## Directory map

```
app/
  layout.tsx              # <html>/<body>/fonts; global metadata
  page.tsx                # Dashboard: stat tiles + recent invoices
  globals.css             # Tailwind + .field/.btn/.card tokens, @media print
  not-found.tsx           # 404
  invoices/
    page.tsx              # Invoice list (status tabs + search)
    new/page.tsx          # Creates an invoice via newInvoice()
    [id]/page.tsx         # Loads an existing invoice (keyed remount)
  estimates/              # Same shape as invoices/
    page.tsx
    new/page.tsx
    [id]/page.tsx
  clients/page.tsx        # Full CRUD, cards + edit modal
  reports/page.tsx        # Stats, 12-mo bar chart, outstanding, tax
  settings/page.tsx       # Brand, invoice/estimate defaults, item
                          # library, data export/import/reset

components/
  AppShell.tsx            # Sidebar + MobileNav + KeyboardShortcuts
  Sidebar.tsx             # Desktop nav
  MobileNav.tsx           # Top bar + bottom nav on phones
  KeyboardShortcuts.tsx   # N / Shift+N / g then d/i/e/c/r/s
  Logo.tsx                # Inline SVG wordmark
  StatusBadge.tsx         # Renders every DocumentStatus value
  LogoUpload.tsx          # Image → PNG rasterizer (canvas), 8MB cap
  LineItemsTable.tsx      # Qty/rate/amount editor
  InvoiceEditor.tsx       # The big one. Handles BOTH kinds.
  InvoicePreview.tsx      # Shared print/preview component

lib/
  types.ts                # Invoice, Client, Payment, InvoicePrefs...
  currencies.ts           # 15 currencies + formatMoney
  totals.ts               # calcTotals + sumPayments
  storage.ts              # All localStorage CRUD + migration helpers
  pdf.ts                  # jsPDF exporter (handles both kinds)
  email.ts                # buildInvoiceMailto (RFC-6068 safe)
  import.ts               # Hardened backup JSON parser
  sample.ts               # Three demo invoices for the dashboard CTA

proxy.ts                  # Per-request nonce CSP (was middleware.ts)
eslint.config.mjs         # ESLint 9 flat config
next.config.js            # Non-CSP security headers
.github/
  workflows/ci.yml        # Lint, build, npm audit
  dependabot.yml          # Weekly npm + actions updates
SECURITY.md               # Full audit against the vibe-code checklist
README.md                 # User-facing
LICENSE                   # MIT
```

---

## Key architecture decisions you need to know

### 1. Invoice and estimate share one type

Both documents are the same `Invoice` type with a `kind` discriminator
(`"invoice" | "estimate"`). The field is optional for backward compat;
`loadInvoices()` normalizes missing `kind` to `"invoice"` on read.
Estimates live in a separate storage key (`annexinvoice.estimates.v1`)
with their own counter. The shared editor branches on
`invoice.kind === "estimate"` to swap labels, status options, hide the
payments section, and swap the primary top-bar button.

If you add another doc type (receipts, purchase orders, delivery
notes), follow this same pattern: extend `DocumentKind`, add a storage
key + counter + `newX()` helper + `upsertX`/`removeX`/`duplicateX`,
wire `upsertDocument`/`removeDocument`/`duplicateDocument` kind-aware
dispatchers, and add pages that pass an initialX through to
`InvoiceEditor`.

### 2. Payments are an array, legacy single field still works

`Invoice.payments: Payment[]` is the source of truth for new code.
`Invoice.amountPaid: number` is kept for records created before the
payments array existed — `sumPayments(invoice)` returns the array sum
when present, falling back to `amountPaid`. `calcTotals()` already
uses `sumPayments`, so every downstream reader (PDF, preview,
dashboard, reports) sees the correct amount paid without branching.

### 3. Editor auto-save

`InvoiceEditor` debounces (`500 ms`) and skips the first mount via a
`didMountRef` so just opening an invoice doesn't bump its
`updatedAt`. It only propagates `invoice.business` back to the global
store when it actually changed (`initialBusinessRef` compare) — this
prevents an old invoice's business snapshot from clobbering newer
Settings. The hide-timer for the "Saved" chip is held in a ref so
back-to-back edits don't leak timers.

### 4. The new-page counter guard

React StrictMode double-invokes effects in dev, which was burning an
invoice number per visit (first invoice came out `INV-0002`). Both
`/invoices/new` and `/estimates/new` guard their init with a
`didInitRef` so the counter advances exactly once per visit.

### 5. The [id] page key

Navigating between two invoices (e.g. after Duplicate) reuses the
same `<InvoiceEditor>` component. Its `useState(initialInvoice)` only
runs on mount, so without a key change the editor would show stale
state for the second invoice. Both `[id]` pages pass
`key={invoice.id}` so React remounts the editor when the id changes.

### 6. CSP: strict in prod, relaxed in dev

`proxy.ts` emits a per-request nonce CSP. In dev it has to allow
`'unsafe-eval'` and `ws:`/`wss:` because Next.js's HMR runtime uses
`eval()` and WebSockets — without these, every page in `npm run dev`
hangs on its first-render loading state (this was a real bug caught
during the last session). Production strips those back out. If you
see pages freezing in dev, check the browser console for a CSP
violation first.

**Every route must render per request.** `app/layout.tsx` sets
`export const dynamic = "force-dynamic"`. Next.js can only stamp the
nonce onto its `<script>` tags at request time; prerendered (static)
pages ship scripts with no nonce, and the strict production CSP then
blocks all of them, so the app never hydrates. Until Nov 2026 every
route was static and production was broken this way (dev hid it,
because the dev CSP allows `'unsafe-inline'`). Don't remove that
export. Always check a change with `npm run build && npm start`, not
just `npm run dev`.

### 6a. Lint: one rule deliberately off

`eslint.config.mjs` turns off `react-hooks/set-state-in-effect`.
Every page hydrates from localStorage with
`useEffect(() => setX(loadX()), [])`, which is the right pattern for
browser-only storage (reading it during render would cause a
hydration mismatch). A `useSyncExternalStore` store is the refactor
if you ever want the rule back on.

### 7. PDF exporter is text-first, logos are PNG-only

`lib/pdf.ts` uses jsPDF's `addImage` directly — no html2canvas, no
React tree serialization. `LogoUpload` rasterizes every uploaded
image (including SVGs) to PNG via a `<canvas>` before storing it in
`localStorage`, so the PDF exporter can assume PNG data URLs and
never has to handle SVG (jsPDF can't).

### 8. Dates are local, not UTC

`todayISO()` and `addDaysISO()` in `lib/storage.ts` format against
the local calendar, **not** `Date#toISOString()` (which converts to
UTC and off-by-ones for users at UTC-\*). Any new date math should
use these helpers, not raw `Date`.

### 9. Security hardening

Full audit in `SECURITY.md`. Key invariants to preserve:
- No `dangerouslySetInnerHTML` anywhere
- No raw user input flowed into HTML attributes or `href`
- Mailto `to` goes through `sanitizeEmailAddress()` (strips CRLF)
- Logo uploads capped at 8 MB before `FileReader`
- Backup imports go through `parseBackup()` in `lib/import.ts`
  (strips `__proto__`, validates MIME on logo data URLs, length-caps
  every string)
- All `localStorage.setItem` writes go through `safeSet()` so
  `QuotaExceededError` surfaces to the user
- Every input that reaches localStorage has a `maxLength`

---

## Testing & dev loop

```bash
npm install
npm run dev     # http://localhost:3100, HMR-safe CSP
npm run build   # Must pass before pushing (CI runs it too)
npm start       # Serve the build: the only way to see the strict CSP
npm run lint
```

There is **no test suite yet**. The verification pattern used across
the last few sessions is Playwright scripts kept in
`/tmp/.../scratchpad/` (session-scoped, not committed) — they boot
the dev server, navigate the UI, and save screenshots. If you want
to promote them into the repo, drop them under `tests/` and wire up
`@playwright/test` — package.json dev deps don't currently include it.

For a dev smoke test: load `/` → click **Load sample data** → the
dashboard, invoice list, clients, and reports pages should all
populate. `lib/sample.ts` holds the fixtures.

---

## Push + GitHub

The repo is `Annex-Logistics/invoice-` (public). Work on a branch and
open a PR against `main`; CI runs on both.

PR and commit attribution: match whatever system reminder the
session carries.

---

## What's done

- Dashboard, invoice list, estimate list, clients CRUD, reports,
  settings
- Full invoice/estimate editor with auto-save, duplicate, delete,
  preview modal, email, PDF export, mark-as-sent, convert-to-invoice
- Payments history with record-payment UI, PDF + preview rendering
- Client picker modal + save-as-client from the Bill To section
- Item library (save/pick saved items)
- Logo upload with canvas rasterization and size cap
- Invoice numbering defaults (prefix, next number, padding) separate
  for invoices and estimates
- 15 currencies, segmented %/$ toggle for discount and tax
- Reports: monthly billing bar chart, outstanding-by-client, tax
  collected
- JSON backup export + hardened import
- Keyboard shortcuts (N, Shift+N, g then d/i/e/c/r/s)
- Responsive (desktop sidebar, mobile bottom nav)
- Print preview with @page: Letter / margin: 0
- Not-found page
- Full security headers in prod, dev-safe CSP
- Dependabot + CI
- SECURITY.md audit report
- Next 16 / React 19 / jsPDF 4 upgrade, ESLint 9 config, production CSP fix (Nov 2026)

## Known rough edges / good next steps

Nothing shipping broken, but these are obvious follow-ups the next
session can take on:

1. **No real test suite.** Promote the scratchpad Playwright flows
   into `tests/e2e/` with `@playwright/test`, and have CI run them
   against a built app.
2. **Clients attribution is heuristic.** Reports and client cards
   match an invoice's bill-to to a saved client by email, then name,
   case-insensitive. Add a nullable `clientId` on `Invoice` and have
   the Pick-client flow set it, so attribution survives renames.
3. **Reports don't filter by date range.** Monthly chart shows last
   12 months hard-coded. Add a range picker.
4. **Recurring invoices** — not implemented. Would need a schedule
   definition on `Invoice` + a `/recurring` section that generates
   new invoices on each fire. In a local-only app this would have to
   be lazy (generate on next page load when due), since there's no
   backend scheduler.
5. **Multiple businesses.** Everything assumes one. Would need a
   `businesses` list in storage + a current-business picker in the
   top bar.
6. **Dark mode.** Not implemented. The color tokens are already
   defined in `tailwind.config.ts`; would need a `prefers-color-scheme`
   branch + `dark:` variants on the card/field classes.
7. **Nonce-based CSP for styles.** Script-src is already nonce'd, but
   style-src still allows `'unsafe-inline'` for Tailwind. Could tighten
   with a custom PostCSS pass.
8. **Delivery note / receipt doc types.** The editor is already
   generic over `kind` — adding another kind is mechanical following
   the recipe in "Key architecture decisions" above.
9. **PDF typography.** Currently Helvetica built-in. Could embed Inter
   via jsPDF's font loader to match the on-screen preview exactly.
10. **Timezone of dueDate comparisons.** Already fixed, but worth a
    pass with a user at a non-UTC offset.

---

## How to run local dev in this fresh environment

```bash
cd invoice-          # repo root
npm install          # once per fresh session container
npm run dev          # pin localhost:3100
```

To see a populated UI, open `/` and click **Load sample data** — this
calls `sampleInvoices()` from `lib/sample.ts` and writes three
invoices (Harbor & Finch, Meridian Coffee Roasters, Oak & Iron
Furniture) in various statuses into `localStorage`.

Then: `/invoices`, `/invoices/[id]`, `/estimates/new`, `/clients`,
`/reports`, `/settings` all render.

---

Welcome to the project.
