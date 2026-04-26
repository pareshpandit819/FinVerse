import { auth } from "@/lib/auth";
import { prisma } from "@repo/db/client";
import { decryptMfaSecret } from "@repo/shared/crypto";
import { verifyTotp } from "@repo/shared/totp";
import { MfaChallengeSchema } from "@repo/shared/schemas";

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
    return Response.json({ verified: true, enrolled: false });
  }

  const secret = decryptMfaSecret(mfaSecret.encryptedSecret);
  const valid = verifyTotp(secret, result.data.token);
  if (!valid) {
    return Response.json({ error: "Invalid or expired TOTP token" }, { status: 400 });
  }

  return Response.json({ verified: true, enrolled: true });
}
