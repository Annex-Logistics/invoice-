# AnnexInvoice — Security Audit

This file records how AnnexInvoice maps to the **Vibe-Coded Web Application
Security Audit Checklist**, which sections apply, which are N/A given the
architecture, and what we've hardened in the code.

## Architecture (why many sections are N/A)

AnnexInvoice is a **100% client-side Next.js application**. It has:

- **No backend.** All code is prerendered static HTML + client JS.
- **No API endpoints.** There is no server to call.
- **No database.** State lives in the viewer's `localStorage`.
- **No authentication / sessions / cookies.** The app is a single-user,
  per-browser tool.
- **No payment processing.** It generates invoices; it does not charge or
  settle anything.
- **No file server / uploads to a backend.** Logos are rasterized in the
  browser via canvas and stored as a data URL in `localStorage`.
- **No telemetry / analytics / third-party tracking.**
- **Outbound network calls at runtime:** only Google Fonts (CSS + font
  files) for the Inter typeface. No XHR, fetch, or WebSocket calls to any
  backend.

As a consequence, whole sections of the checklist — Authentication,
Authorization, API/Backend Security, Database, Admin Panel, Server Logging,
Payments — are **Not Applicable** to the application itself. They remain
the responsibility of the host that serves the static bundle.

---

## Section-by-section verdict

### 1. AI-Generated Code and Supply-Chain Review

- **Pass** — No `TODO` / `FIXME` / `skipAuth` / mock-auth markers in
  production code.
- **Pass** — No hard-coded credentials, demo users, or test bypasses
  (there's no auth to bypass).
- **Pass** — Dependencies are exact-pinned in `package.json` (no `^` or
  `~` ranges). `package-lock.json` is committed.
- **Pass** — No `postinstall` or lifecycle scripts in `package.json`.
- **Action for the operator:** run `npm audit` before shipping and after
  dependency bumps.

### 2. Authentication and Account Security — **N/A**

No user accounts, no sessions, no passwords. The app has no concept of
"logged in."

### 3. Authorization and Access Control — **N/A**

No server-side operations exist. All data is scoped to the viewer's own
browser `localStorage`, which the OS and browser isolate per-origin.

### 4. Input Validation and Injection

- **Pass (XSS)** — All user-entered text is rendered through React's
  automatic escaping. There are **no** uses of `dangerouslySetInnerHTML`
  anywhere in the codebase (verified by `grep`).
- **Pass (SQL/NoSQL/OS injection)** — N/A; no query language or shell
  execution.
- **Fixed (mailto injection)** — `buildInvoiceMailto` now strips
  whitespace, CRLF, and mailto-reserved characters from the `to`
  address so a pasted `test@x.com%0ACc:evil@y.com` cannot inject extra
  headers (`lib/email.ts`).
- **Fixed (backup JSON validation)** — `importData` now routes through
  a conservative parser (`lib/import.ts`) that coerces every field to
  the expected shape and length, drops `__proto__` / `constructor` /
  `prototype` keys, validates image data URLs against a safelist of
  MIME types, caps the backup file at 20 MB before reading, and
  returns per-record warnings for skipped malformed entries.
- **Pass (redirects)** — No use of user input as a redirect
  destination.

### 5. API and Backend Security — **N/A**

No API routes. The Next.js build has only client-rendered pages. No
server actions, webhooks, or RPC endpoints.

### 6. Database and Data Protection

- Data is in the viewer's `localStorage`, under keys prefixed
  `annexinvoice.`. Browsers isolate storage per origin.
- **Fixed (quota exhaustion)** — All `localStorage.setItem` calls
  now go through a `safeSet` helper that catches `QuotaExceededError`,
  logs it, and shows the user a clear "export a backup and prune" alert
  instead of silently losing their invoice (`lib/storage.ts`).
- **Pass** — No sensitive secrets are stored (no tokens, no card data).
  The data at rest is: business profile, client contact details, line
  items. Users are told in `README.md` that the data lives in the
  browser and should be backed up.

### 7. Secrets and Configuration Management

- **Pass** — No API keys, tokens, URLs, or secrets of any kind in the
  repo. `grep -r -i 'api[_-]key\|secret\|password\|token' --include='*.{ts,tsx,js,json}'`
  returns nothing but TypeScript's `keyof`, Tailwind's "focus-", and
  localStorage key names.
- **Pass** — No `.env*` files are tracked. `.gitignore` excludes them.
- **Pass** — No `NEXT_PUBLIC_*` variables containing anything sensitive
  (none are used at all).

### 8. Frontend, Browser, and Session Security

- **Pass (no cookies)** — The app sets no cookies.
- **Fixed (security headers)** — `next.config.js` now serves the
  following on every response:
  - `Content-Security-Policy` — `default-src 'self'`, with explicit
    allowances only for Tailwind inline styles, the Google Fonts CSS,
    `data:` + `blob:` images (for logo data URLs and PDF/Blob
    downloads), `frame-ancestors 'none'` (clickjacking defense),
    `object-src 'none'`, and `form-action 'self'`.
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`
  - `X-DNS-Prefetch-Control: off`
  - `X-Powered-By` is suppressed.
- **Pass (external links)** — All `target="_blank"` links use
  `rel="noreferrer"` (sidebar is the only one).
- **Pass (localStorage)** — Storage is used only for the app's own
  invoice data, as documented. No tokens are kept there, because there
  are no tokens.
- **Caveat:** CSP currently allows `'unsafe-inline'` for scripts and
  styles. This is required by Next.js's hydration bootstrap and
  Tailwind's style injection. Moving to a nonce-based CSP would require
  a custom middleware; it is deferred and recorded here.

### 9. File Uploads and Downloads

Only the Logo upload is in scope, and it is 100% client-side.

- **Pass** — File input uses `accept="image/*"` and we re-check
  `file.type.startsWith("image/")` server-side-equivalent (inside the
  component).
- **Fixed (DoS via oversized image)** — We now reject uploads larger
  than **8 MB** before touching `FileReader`, so a user can't force the
  browser to allocate hundreds of MB.
- **Pass (SVG XSS)** — Every upload is rasterized to a PNG data URL via
  `<canvas>` and bounded to 512 px on the long edge. Any scripts
  embedded in an SVG are discarded during rasterization.
- **Pass (path traversal)** — N/A; nothing is written to a filesystem.
  Logos are stored as data URLs in `localStorage`.
- **Pass (filename safety)** — PDF export filenames go through
  `safeFilename()` (`lib/pdf.ts`) which strips `\ / : * ? " < > |` and
  control chars and caps length.

### 10. Payments / Wallets / Billing — **N/A**

The app produces an invoice *document*; it does not charge cards,
settle funds, or hold balances. No payment provider is integrated.

### 11. Admin Panel and Privileged Operations — **N/A**

No privilege separation exists because there are no users.

### 12. Logging, Monitoring, and Incident Response — **N/A**

No server logs. Client console logs contain only quota-exceeded error
reports (no PII).

### 13. Infrastructure, Hosting, and Deployment

Delivered as a Next.js app for the operator to host. Items the
**operator** needs to verify on whichever hosting platform they use:

- **Required:** HTTPS is enforced; HTTP → HTTPS redirect is live.
- **Required:** Valid TLS certificate with monitored renewal.
- **Required:** Static build is served without exposing the `.next`
  server internals or sourcemaps publicly beyond what is intended.
- **Shipped by the app:** The response headers in §8 are emitted by
  `next.config.js`, so they apply on any Next.js-compatible host
  (Vercel, Netlify, self-hosted). On static-only hosts (S3/CloudFront,
  Cloudflare Pages) the operator must configure the same headers at
  the CDN level, since static hosts ignore `next.config.js`.

### 14. Privacy and Data Governance

- **Pass (minimum collection)** — The app collects only what the user
  types into it. Nothing is transmitted off the device.
- **Pass (right to delete)** — Settings → **Reset everything** erases
  all invoices, business info, prefs, and the item library from the
  browser immediately.
- **Pass (data export)** — Settings → **Export backup** produces a
  self-contained JSON of everything the app stores for the user.
- **Pass (no third-party processors)** — The only external request at
  runtime is to Google Fonts for a font file; this is an HTTPS GET with
  no user data in headers or body.

### 15. Security Testing and Release Verification

- **Done:** Manual code review of every file; type-check and lint via
  `next build` with zero errors.
- **Recommended for the operator:**
  - `npm audit` (SCA) before each release.
  - `gitleaks` or `trufflehog` over the repo (nothing to find, but
    confirms).
  - Lighthouse / observatory.mozilla.org run against a staging
    deployment to confirm the headers from §8 are actually emitted by
    the chosen host.

---

## Findings register

| ID       | Finding                                                  | Severity | Status       | Fix                                   |
| -------- | -------------------------------------------------------- | -------- | ------------ | ------------------------------------- |
| SEC-001  | `buildInvoiceMailto` percent-encoded `to`, breaking real-world clients, then later unencoded it without stripping CRLF — mailto header injection vector if a user pasted a crafted address | Medium | **Fixed**    | `sanitizeEmailAddress` in `lib/email.ts` |
| SEC-002  | `LogoUpload` read the full file into memory via `FileReader` with no size cap; user-chosen 500 MB image would OOM the tab | Medium | **Fixed**    | 8 MB upload cap in `components/LogoUpload.tsx` |
| SEC-003  | `importData` in Settings called `JSON.parse` and spread the result into storage without shape validation; `__proto__` / malformed fields could pollute state or crash the app on next render | Medium | **Fixed**    | `parseBackup()` in `lib/import.ts`; wired via Settings page |
| SEC-004  | `localStorage.setItem` had no error handling; `QuotaExceededError` would silently drop a save | Low    | **Fixed**    | `safeSet` helper in `lib/storage.ts` |
| SEC-005  | No security response headers emitted by the app         | Low    | **Fixed**    | `headers()` block in `next.config.js` |
| SEC-006  | PDF filename used `invoice.number` raw — `INV/2026` would break downloads cross-OS | Low    | **Fixed** (earlier) | `safeFilename()` in `lib/pdf.ts` |
| SEC-007  | SVG logos skipped silently by the PDF exporter (and SVG `<script>` in user-supplied SVGs would never execute inside a rasterized PNG anyway, but defense in depth) | Low    | **Fixed** (earlier) | Canvas rasterization in `components/LogoUpload.tsx` |

No Critical or High findings. No release blockers.

---

## Not attempted / out of scope

- **Dynamic application security testing (DAST)** — recommended against
  a staging deployment; not run from this repository.
- **Formal penetration test** — out of scope for a single-author
  open-source client-side tool; still recommended before white-labelling
  for a regulated environment.
- **Threat modelling for a hypothetical backend** — the project has no
  backend plans at the moment. If one is added (sync, sharing, multi-
  user), §2–§6 and §10–§12 move from N/A to in-scope and need their
  own review.

---

**Last reviewed:** against commit matching the current `main` tip at
publication of this document.
