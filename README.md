# AnnexInvoice

A clean, modern invoice builder by **Annex Logistics**.

Create, preview, and download professional PDF invoices in minutes — all in your browser. No signup, no server, no tracking: every invoice is stored locally so your data stays on your device.

## Features

- Invoices, estimates, receipts and delivery notes from one editor
- Business branding (name, logo, address, email, phone, website), with
  several businesses in one browser, each with its own numbering
- Line items, percent or fixed discount and tax, shipping
- Payment history and balance due; receipts from paid invoices
- Delivery notes with quantities only and signature lines
- Recurring invoices (weekly, monthly, quarterly, yearly)
- Saved clients and a saved-items library
- Reports by period and currency: billed, collected, outstanding,
  overdue, tax collected
- 15 built-in currencies; PDFs embed Inter, so signs like ₦ print correctly
- Clean PDF export and a print preview that matches it
- Light and dark themes
- Export / import a JSON backup of all your data
- Auto-save as you type; works on mobile
- No signup, no server, no tracking, no third-party requests

## Tech

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [lucide-react](https://lucide.dev/) icons
- [jsPDF](https://github.com/parallax/jsPDF) for PDF export
- [Playwright](https://playwright.dev/) for unit and end-to-end tests
- `localStorage` for persistence

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3100.

## Build for production

```bash
npm run build
npm start
```

## Deploy

AnnexInvoice is a Next.js app that renders pages per request (the security policy needs a fresh nonce each time), so it needs a Node host: Vercel, Netlify, a VPS, or a container. A static export is not supported.

Example (Vercel):

```bash
npx vercel
```

## Data & privacy

Everything is saved in your browser's `localStorage` under the `annexinvoice.*` keys. Clearing site data erases all invoices, so use **Settings → Export backup** regularly if the invoices matter to you.

## License

MIT © Annex Logistics
