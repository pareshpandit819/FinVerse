import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, buildCsp } from "@/lib/csp";
import { rateLimitByIp } from "@/lib/rate-limit";

const PUBLIC_PATHS = ["/login", "/login/verify", "/login/error", "/api/auth"];
const MFA_CHALLENGE_PATH = "/mfa/challenge";
const MFA_ENROLL_PATH = "/mfa/enroll";

// API routes that have stricter per-IP rate limits (10 req/min)
const STRICT_RATE_LIMIT_PATHS = [
  "/api/plaid/link-token",
  "/api/plaid/exchange",
  "/api/auth/mfa",
];

export default auth(async (req: NextRequest & { auth: { user?: { id?: string } } | null }) => {
  const { pathname } = req.nextUrl;

  // Apply rate limiting to API routes
  if (pathname.startsWith("/api/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";

    const isStrict = STRICT_RATE_LIMIT_PATHS.some((p) => pathname.startsWith(p));
    const limit = await rateLimitByIp(ip, isStrict ? { limit: 10, windowMs: 60_000 } : {});

    if (!limit.allowed) {
      return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(limit.resetAt),
        },
      });
    }
  }

  // Webhook endpoint bypasses auth (signature-verified separately)
  if (pathname === "/api/webhooks/plaid") {
    return NextResponse.next();
  }

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  // Not authenticated → redirect to login
  if (!req.auth?.user?.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // MFA pages are accessible once authenticated
  if (pathname.startsWith(MFA_CHALLENGE_PATH) || pathname.startsWith(MFA_ENROLL_PATH)) {
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  return applySecurityHeaders(NextResponse.next(), pathname);
});

function applySecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  // Skip CSP for static assets (handled by next.config.ts headers)
  if (pathname.startsWith("/_next/") || pathname.match(/\.(ico|png|jpg|svg|webp)$/)) {
    return response;
  }

  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Nonce", nonce); // passed to layout for inline script tags
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
