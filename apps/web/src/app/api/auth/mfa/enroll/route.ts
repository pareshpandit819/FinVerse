import { auth } from "@/lib/auth";
import { prisma } from "@repo/db/client";
import { writeAudit } from "@repo/db";
import { encryptMfaSecret, decryptMfaSecret } from "@repo/shared/crypto";
import { generateTotpSecret, verifyTotp } from "@repo/shared/totp";
import { MfaEnrollSchema } from "@repo/shared/schemas";
import { headers } from "next/headers";

/** GET /api/auth/mfa/enroll — generate a new TOTP setup (secret + otpauth URI) */
export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthenticated" }, { status: 401 });

  const existing = await prisma.mfaSecret.findFirst({
    where: { userId: session.user.id, verified: true },
  });
  if (existing) {
    return Response.json({ error: "MFA already enrolled" }, { status: 409 });
  }

  const { secret, uri } = generateTotpSecret(session.user.email ?? session.user.id);
  const encrypted = encryptMfaSecret(secret);

  // Store as unverified — becomes verified only after the user confirms their first TOTP token
  await prisma.mfaSecret.deleteMany({ where: { userId: session.user.id, verified: false } });
  await prisma.mfaSecret.create({
    data: { userId: session.user.id, encryptedSecret: encrypted, verified: false },
  });

  return Response.json({ uri });
}

/** POST /api/auth/mfa/enroll — confirm enrollment with first TOTP token */
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthenticated" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const result = MfaEnrollSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: "Invalid token format" }, { status: 400 });
  }

  const pending = await prisma.mfaSecret.findFirst({
    where: { userId: session.user.id, verified: false },
  });
  if (!pending) {
    return Response.json({ error: "No pending MFA enrollment. Call GET first." }, { status: 400 });
  }

  const secret = decryptMfaSecret(pending.encryptedSecret);
  const valid = verifyTotp(secret, result.data.token);
  if (!valid) {
    return Response.json({ error: "Invalid TOTP token" }, { status: 400 });
  }

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? undefined;

  await prisma.$transaction(async (tx) => {
    await tx.mfaSecret.update({
      where: { id: pending.id },
      data: { verified: true },
    });

    const membership = await tx.membership.findFirst({ where: { userId: session.user.id } });
    await writeAudit({
      tx,
      userId: session.user.id,
      organizationId: membership?.organizationId ?? null,
      action: "mfa.enrolled",
      entityType: "mfa_secrets",
      entityId: pending.id,
      ipAddress: ip,
    });
  });

  return Response.json({ enrolled: true });
}
