import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, buildCsp } from "@/lib/csp";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/api/register"];
const MFA_CHALLENGE_PATH = "/mfa/challenge";
const MFA_ENROLL_PATH = "/mfa/enroll";

export default auth(async (req: NextRequest & { auth: { user?: { id?: string } } | null }) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  if (!req.auth?.user?.id) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith(MFA_CHALLENGE_PATH) || pathname.startsWith(MFA_ENROLL_PATH)) {
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  return applySecurityHeaders(NextResponse.next(), pathname);
});

function applySecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  if (pathname.startsWith("/_next/") || pathname.match(/\.(ico|png|jpg|svg|webp)$/)) {
    return response;
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Only apply strict CSP in production — dev needs 'unsafe-eval' for hot reload
  // and 'strict-dynamic' breaks Next.js chunk loading in dev mode.
  if (process.env.NODE_ENV === "production") {
    const nonce = generateNonce();
    const csp = buildCsp(nonce);
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("X-Nonce", nonce);
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
