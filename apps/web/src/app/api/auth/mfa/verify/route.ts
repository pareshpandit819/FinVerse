import { auth } from "@/lib/auth";
import { prisma } from "@repo/db/client";
import { decryptMfaSecret } from "@repo/shared/crypto";
import { verifyTotp } from "@repo/shared/totp";
import { MfaChallengeSchema } from "@repo/shared/schemas";

/**
 * POST /api/auth/mfa/verify
 * Validates a TOTP token and stamps mfa_verified_at on the current DB session row.
 * The session callback reads this column back on every request, so the flag is
 * per-session and revoked automatically when the session expires.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const result = MfaChallengeSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: "Invalid token format" }, { status: 400 });
  }

  const mfaSecret = await prisma.mfaSecret.findFirst({
    where: { userId: session.user.id, verified: true },
  });

  if (!mfaSecret) {
    // No MFA enrolled — mark as verified (enrollment prompt is surfaced in the UI)
    return Response.json({ verified: true, enrolled: false });
  }

  const secret = decryptMfaSecret(mfaSecret.encryptedSecret);
  const valid = verifyTotp(secret, result.data.token);
  if (!valid) {
    return Response.json({ error: "Invalid or expired TOTP token" }, { status: 400 });
  }

  // Stamp the DB session row so the session callback propagates mfaVerified=true
  const sessionToken = (session as typeof session & { sessionToken?: string }).sessionToken;
  if (sessionToken) {
    await prisma.session.updateMany({
      where: { sessionToken, userId: session.user.id },
      data: { mfaVerifiedAt: new Date() },
    });
  }

  return Response.json({ verified: true, enrolled: true });
}
