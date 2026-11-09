import { NextResponse, type NextRequest } from "next/server";

// Per-request nonce so our CSP can drop 'unsafe-inline' from script-src.
// Next.js's App Router reads `x-nonce` from the incoming headers and
// automatically attaches it to its hydration <script> tags, so they stay
// permitted by the CSP we emit here.
export function middleware(request: NextRequest) {
  const nonce = globalThis.crypto.randomUUID().replace(/-/g, "");

  const csp = [
    "default-src 'self'",
    // `strict-dynamic` lets the nonce'd Next bootstrap script load the
    // rest; it's ignored by browsers that don't understand it, which
    // then fall back to 'self' + the explicit nonce.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Tailwind inlines its tokens via <style> at build time.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Skip static assets, the Next.js runtime chunks, and the favicon —
    // they don't need per-request CSP and running middleware on them
    // defeats CDN caching.
    "/((?!_next/static|_next/image|favicon\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
