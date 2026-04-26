/**
 * Content Security Policy builder.
 * Generates a per-request nonce and the corresponding CSP header value.
 *
 * Next.js inline scripts use the nonce; external scripts are allow-listed by origin.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp(nonce: string): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Allow Plaid Link SDK (loaded via script tag)
      "https://cdn.plaid.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'"], // Tailwind inlines styles
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      // Plaid Link
      "https://cdn.plaid.com",
      "https://production.plaid.com",
      "https://sandbox.plaid.com",
      "https://development.plaid.com",
      // Auth.js
      "https://accounts.google.com",
    ],
    "frame-src": [
      "'self'",
      // Plaid Link opens an iframe
      "https://cdn.plaid.com",
    ],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([key, values]) =>
      values.length > 0 ? `${key} ${values.join(" ")}` : key
    )
    .join("; ");
}
