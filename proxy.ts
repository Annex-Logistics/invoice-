import { NextResponse, type NextRequest } from "next/server";

// Per-request nonce so our CSP can drop 'unsafe-inline' from script-src.
// Next.js's App Router reads `x-nonce` from the incoming headers and
// automatically attaches it to its hydration <script> tags, so they stay
// permitted by the CSP we emit here.
export function proxy(request: NextRequest) {
  const nonce = globalThis.crypto.randomUUID().replace(/-/g, "");
  const isDev = process.env.NODE_ENV !== "production";

  // Next.js's dev runtime uses eval() for HMR and new WebSocket for
  // the HMR channel. Those have to be allowed in dev; production
  // builds don't need either, so the policy there stays strict.
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const connectSrc = isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'";
  // Dev injects <style> tags for HMR. Production serves only built CSS
  // files, so inline <style> and style="" attributes are both banned
  // (the nonce covers any style tag Next.js itself emits). Don't add
  // style={{...}} props: draw with SVG attributes or classes instead.
  const styleSrc = isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`;

  const csp = [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    "font-src 'self'",
    "img-src 'self' data: blob:",
    connectSrc,
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
    // they don't need per-request CSP and running the proxy on them
    // defeats CDN caching.
    "/((?!_next/static|_next/image|favicon\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)",
  ],
};
