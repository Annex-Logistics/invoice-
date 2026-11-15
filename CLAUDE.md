# AnnexInvoice — Project Guide for Claude Code

This file is read automatically when you open a session in this repo.
It tells you what the project is, what's built, how it's wired, and
where to pick up.

Repo: https://github.com/Annex-Logistics/invoice- (branch `main`)
Owner: Annex Logistics. (Originally built at `patricku-cpu/invoice`;
moved to the Annex-Logistics org in Nov 2026.)

---

## What this is

A clean, browser-based builder for invoices, estimates, receipts and
delivery notes, modelled on the feature set of app.invoicesimple.com
but as an original implementation — no backend, no login, no
telemetry, no third-party requests. Everything runs client-side in
Next.js and persists to `localStorage` under the `annexinvoice.*` key
namespace. Brand-blue, Inter-based UI with light and dark themes, a
left sidebar on desktop and a bottom nav (plus a More menu) on mobile.

Four document kinds share one editor, one preview and one PDF
exporter. `lib/docTypes.ts` describes how each behaves:

- **Invoices** — `draft | sent | paid | overdue`; payments are an
  array of `{ date, method, amount, note }`; can repeat on a schedule.
- **Estimates** — `draft | sent | accepted | declined`; the second
  date is "Valid until"; **Convert to invoice** keeps the estimate.
- **Receipts** — `draft | issued`; one date; show payments. Created
  blank or from an invoice.
- **Delivery notes** — `draft | sent | delivered`; quantities only,
  no prices; signature lines. Created blank or from an invoice.

It supports several businesses in one browser (each with its own
brand, numbering, defaults and documents), saved clients and items,
reports by period and currency, and JSON backups.

---

## Stack

- **Next.js 16.4** (App Router, Turbopack) + **React 19** + TypeScript
  (strict). Upgraded from 14.2 in Nov 2026 to clear critical
  advisories; 14.x has no patched release.
- **Tailwind CSS 3.4** — tokens defined in `tailwind.config.ts`
  (brand-\* and ink-\* scales)
- **lucide-react** icons
- **jsPDF 4.2** for text-first PDF export with embedded Inter — no
  html2canvas, no server-side rendering of the PDF
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
  layout.tsx              # <html>, theme script, font preload; force-dynamic
  page.tsx                # Dashboard: stat tiles + recent invoices
  globals.css             # Fonts, theme tokens (light/dark), .field/.btn/.card, print
  not-found.tsx           # 404
  invoices/               # page.tsx (list), new/page.tsx, [id]/page.tsx
  estimates/              # same shape as invoices/
  receipts/               # one-line routes -> components/DocumentPages.tsx
  delivery-notes/         # one-line routes -> components/DocumentPages.tsx
  recurring/page.tsx      # Repeating-invoice schedules
  clients/page.tsx        # Full CRUD, cards + edit modal
  reports/page.tsx        # Period + currency pickers, chart, outstanding, tax
  settings/page.tsx       # Brand, defaults, item library, appearance,
                          # businesses, data export/import/reset

components/
  AppShell.tsx            # Sidebar + MobileNav + shortcuts; runs due
                          # recurring schedules on every page load
  Sidebar.tsx             # Desktop nav + business switcher
  MobileNav.tsx           # Top bar, bottom nav, More menu
  BusinessSwitcher.tsx    # Switch / add business
  KeyboardShortcuts.tsx   # N / Shift+N / g then d,i,e,c,r,s,p,t
  Logo.tsx                # Inline SVG wordmark
  StatusBadge.tsx         # Renders every DocumentStatus value
  LogoUpload.tsx          # Image -> PNG rasterizer (canvas), 8MB cap
  LineItemsTable.tsx      # Qty/rate/amount editor (showPrices prop)
  InvoiceEditor.tsx       # The big one. Handles ALL document kinds.
  InvoicePreview.tsx      # Shared print/preview (.paper: always light)
  RecurringModal.tsx      # Create / edit / stop a schedule
  DocumentPages.tsx       # Generic list / new / edit pages by kind

lib/
  types.ts                # Invoice, Client, Payment, RecurringSchedule,
                          # BusinessProfile...
  docTypes.ts             # Per-kind config: labels, statuses, dates,
                          # payments / prices / signature
  storage.ts              # All localStorage CRUD, numbering, businesses,
                          # recurring runner
  totals.ts               # calcTotals + sumPayments
  reports.ts              # Date ranges, currency grouping, summaries, buckets
  recurring.ts            # Pure schedule maths
  clients.ts              # matchClient(): clientId, then email, then name
  theme.ts                # Light / dark / system
  currencies.ts           # 15 currencies + formatMoney
  pdf.ts                  # jsPDF exporter with embedded Inter
  email.ts                # buildInvoiceMailto (RFC-6068 safe)
  import.ts               # Hardened backup JSON parser
  sample.ts               # Three demo invoices for the dashboard CTA

public/
  theme-init.js           # Sets .dark before first paint (nonce'd)
  fonts/                  # Inter woff2 (UI) + ttf (PDF) + OFL licence

tests/
  unit/                   # Pure-function tests
  e2e/                    # Browser tests against the production build

proxy.ts                  # Per-request nonce CSP (was middleware.ts)
eslint.config.mjs         # ESLint 9 flat config
playwright.config.ts      # unit + e2e projects, e2e server on :3110
.github/
  workflows/ci.yml        # Lint, build, unit, e2e, npm audit
  dependabot.yml          # Weekly npm + actions updates
SECURITY.md               # Audit against the vibe-code checklist
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
with their own counter. The shared editor reads `docType(kind)` from
`lib/docTypes.ts` for labels, status options, dates, and whether to
show payments and prices.

Receipts and delivery notes came later and use a generic store
(`loadDocs(kind)` / `saveDocs(kind)` in `lib/storage.ts`) plus
`lib/docTypes.ts`. To add another kind, follow the recipe under
"Backlog" item 8 below, not the older invoice/estimate functions.

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
- No `style={{…}}` props (blocked by the production CSP)
- No third-party requests (fonts are self-hosted)
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
npm run test:unit   # pure-function tests, no server needed
npm run test:e2e    # needs `npm run build` first; boots `next start` on 3110
```

Tests use `@playwright/test` for both layers (one runner, one config:
`playwright.config.ts`):

- `tests/unit/` — `calcTotals`, `sumPayments`, backup parsing
  (round-trip, prototype pollution, bad logos), mailto building.
- `tests/e2e/` — runs against the **production build** so the strict
  CSP is in force. Every route must hydrate with zero console errors
  (a CSP violation is a console error), every `<script>` must carry
  the response's nonce, plus flows: create invoice → record payment →
  mark sent, PDF download, estimate → invoice, backup export/import.

First run on a new machine: `npx playwright install chromium`.
CI runs unit tests in the build job and e2e in its own job, uploading
the Playwright report on failure.

**Backups must carry every storage key.** `exportData()` in
`app/settings/page.tsx` and `parseBackup()` in `lib/import.ts` must
cover every collection and every field. Until Nov 2026 they silently
dropped estimates, clients and payment history. Any new collection or
field (clientId, recurring schedules, businesses…) needs adding to
both, plus a case in `tests/unit/backup.spec.ts`.

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

- Dashboard, lists and editor for invoices, estimates, receipts and
  delivery notes; clients CRUD; reports; settings
- Editor: auto-save, duplicate, delete, preview, email, PDF export,
  mark-as-sent, convert estimate to invoice, create receipt / delivery
  note from an invoice
- Payments history; client picker with a stable `clientId` link
- Recurring invoices (lazy, catch-up on app load)
- Multiple businesses with separate numbering and documents
- Reports by period and currency; never sums across currencies
- Item library; logo upload with canvas rasterization and size cap
- Light / dark / system theme
- PDFs with embedded Inter (Naira and non-Latin names print correctly)
- JSON backup v3 (every collection, every business) + hardened import
- Keyboard shortcuts; responsive with a mobile More menu
- Strict production CSP: nonce'd scripts, no inline styles, no
  third-party requests; self-hosted fonts
- Next 16 / React 19 / jsPDF 4; ESLint 9; Dependabot + CI
- Test suite: unit + e2e against the production build

## Backlog from the original handover (all done)

Kept because each entry records how the feature works.

1. ~~**No real test suite.**~~ Done (Nov 2026): `tests/unit` + `tests/e2e`
   with `@playwright/test`, run in CI against the production build.
2. ~~**Clients attribution is heuristic.**~~ Done (Nov 2026):
   `Invoice.clientId` is set by Pick client / Save as client (a "Saved
   client" chip can unlink it). `matchClient()` in `lib/clients.ts`
   uses the id first, then falls back to email/name for legacy records.
   Use `matchClient()` anywhere you attribute documents to clients.
3. ~~**Reports don't filter by date range.**~~ Done (Nov 2026): period
   presets + custom range, and a currency picker. Logic lives in
   `lib/reports.ts` (pure, unit-tested). **Never sum different
   currencies**: reports and the dashboard tiles show one currency at
   a time (most-used by default). The dashboard's Collected tile used
   to read legacy `amountPaid` and ignore recorded payments; it now uses
   `summarize()`.
4. ~~**Recurring invoices**~~ Done (Nov 2026). Open an invoice → Repeat.
   A `RecurringSchedule` (storage key `annexinvoice.recurring.v1`)
   points at a source invoice and copies its *current* content on each
   run as a draft with `recurringId` set. Runs are lazy:
   `runDueSchedules()` is called from `AppShell` on every page mount,
   catches up missed dates (max 24 per load), and is idempotent per
   (schedule, date) so two tabs can't double-generate. Occurrence n is
   computed from the anchor date, so month-ends don't drift. Pure logic
   in `lib/recurring.ts`; UI in `components/RecurringModal.tsx` and
   `/recurring`. Resuming a paused schedule skips the missed dates.
5. ~~**Multiple businesses.**~~ Done (Nov 2026). Switcher in the
   sidebar / mobile header; managed under Settings → Businesses.
   **Design:** the ACTIVE business still lives in the original keys
   (`business.v1`, `prefs.v1`, counters), so `loadBusiness()` /
   `loadPrefs()` callers didn't change. All businesses are
   `BusinessProfile`s in `annexinvoice.businesses.v1`;
   `switchBusiness()` syncs the active keys into its profile and loads
   the target's. Documents carry `businessId` (stamped on first run by
   `ensureBusinesses()`); lists/totals/reports use
   `loadCurrentInvoices()` / `loadCurrentEstimates()`. Numbering is per
   business (`nextInvoiceNumber(businessId)`); recurring runs number
   from the source's business. Clients and saved items are shared.
   Switching reloads the page. Only an inactive business with no
   documents can be deleted. Backups are v3 (`businesses` +
   `currentBusinessId`); importing an older single-business backup
   replaces only the active business's documents.
6. ~~**Dark mode.**~~ Done (Nov 2026). Settings → Appearance: match
   system (default), light or dark; stored per device in
   `annexinvoice.theme.v1`, not in backups. **How it works:** every
   `brand-*` / `ink-*` shade and `white` in `tailwind.config.ts` reads
   a CSS variable defined in `app/globals.css`; `.dark` on `<html>`
   swaps the variable set, so components need no `dark:` variants.
   Use the tokens (`bg-white`, `text-ink-900`, `border-ink-100`…) for
   new UI and it themes itself. Fixed Tailwind colours (emerald, rose,
   amber, blue) have explicit `.dark` overrides at the bottom of
   `globals.css`: add one if you introduce a new fixed colour.
   `.paper` (the invoice preview) and print always use the light set.
   `public/theme-init.js` runs in `<head>` with the CSP nonce to avoid
   a light flash; keep it in sync with `lib/theme.ts`.
7. ~~**Nonce-based CSP for styles.**~~ Done (Nov 2026). Production
   `style-src` is `'self' 'nonce-…'`: no `'unsafe-inline'`, so inline
   `<style>` and `style=""` attributes are blocked. **Never use
   `style={{…}}` props** (the reports chart draws bars with SVG
   attributes instead). Inter is self-hosted from `public/fonts`
   (variable woff2, latin + latin-ext, OFL licence alongside), so the
   app makes no third-party requests at all; an e2e test asserts both.
8. ~~**Delivery note / receipt doc types.**~~ Done (Nov 2026).
   `lib/docTypes.ts` is now the single description of every document
   kind (label, route, statuses, second-date label, whether it has
   payments / prices / signature lines). The editor, preview, PDF,
   email and backup parser read it instead of branching on `kind`.
   **To add a kind:** add it to `DocumentKind` and `DOC_TYPES`, give it
   a key in `EXTRA_KEYS` (`lib/storage.ts`), add three one-line route
   files using `components/DocumentPages.tsx`, add nav entries, and add
   it to the backup export/import/reset in Settings.
   - Receipts (`REC-`): single date, statuses draft/issued, payments
     shown. "Create receipt" on an invoice copies its payments.
   - Delivery notes (`DN-`): no prices anywhere, statuses
     draft/sent/delivered, signature lines. "Create delivery note" on
     an invoice copies items and addresses.
   - Both store `sourceNumber` (the invoice they came from) and number
     per business via `annexinvoice.docCounters.v1`.
   - Mobile: the bottom bar gained a **More** menu (Receipts, Delivery
     notes, Recurring, Clients, Settings), and the editor's status /
     quick-action rail now shows below the form on small screens.
9. ~~**PDF typography.**~~ Done (Nov 2026), and it was more than
   cosmetic. jsPDF's built-in Helvetica only covers Windows-1252, so
   the Naira sign printed as a broken bar with stretched digits that
   ran off the page, and names like "Chịdị" were garbled.
   `lib/pdf.ts` now embeds Inter Regular + Bold (`public/fonts/*.ttf`,
   fetched on first export, cached for the session) and falls back to
   Helvetica if the fetch fails. Use `doc.setFont(FONT, …)`, never a
   hard-coded family. Multi-line addresses used to overprint the lines
   below them; all text blocks now go through `drawLines()`, which
   splits on newlines and wraps. **Check PDF changes by eye**: generate
   one with a Naira invoice and a multi-line address and open it; the
   e2e tests only assert structure (valid PDF, font embedded).
10. ~~**Timezone of dueDate comparisons.**~~ Checked (Nov 2026). All
    calendar maths uses local dates. `tests/e2e/timezone.spec.ts` pins
    the clock to moments where local and UTC dates differ (Lagos just
    after midnight, Los Angeles late evening, a month boundary) and
    checks new-invoice dates, overdue, recurring runs and reports.

## Open items / good next steps

1. **CI has never run on GitHub.** This repo is a fork of
   `patricku-cpu/invoice`, and GitHub disables workflows on forks until
   an owner opens the **Actions** tab and enables them. Every CI step
   passes locally on Windows; the Linux run is unverified.
2. **Defaults are US-flavoured.** New installs default to USD, 0% tax
   and Letter-size PDFs/print; sample data uses US addresses and sales
   tax. For Annex (Nigeria) consider NGN, VAT 7.5% and A4. A product
   decision, so left alone.
3. **Receipt / delivery-note prefixes aren't editable.** `REC-` and
   `DN-` are fixed in `lib/docTypes.ts`; invoices and estimates have
   Settings fields.
4. **Storage ceiling.** Everything is in `localStorage` (5–10 MB per
   origin) and each document snapshots the business, logo included. A
   busy user will hit the quota (there is an alert). IndexedDB, or
   storing the logo once per business, would lift it.
5. **One browser only.** No sync between devices; backups are manual.
   A reminder to export, or optional cloud sync, is the natural step.
6. **`react-hooks/set-state-in-effect` is off** (see 6a). A
   `useSyncExternalStore` store would let it back on and remove the
   page reload when switching business.
7. **8 moderate `npm audit` findings** in dev-only lint tooling
   (`minimatch` under typescript-eslint). Below CI's threshold; will
   clear when upstream updates.
8. **No deployment is configured.** It needs a Node host (pages render
   per request for the CSP nonce); a static export would need the CSP
   reworked to hashes.

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
