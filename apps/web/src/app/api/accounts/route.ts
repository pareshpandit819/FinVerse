import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { CreateAccountSchema } from "@repo/shared/schemas";
import { toCents } from "@repo/shared/money";
import { netWorthQueue } from "@/lib/queues";

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = CreateAccountSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid request body", issues: result.error.issues }, { status: 400 });
    }

    const { organizationId, name, type, balanceCurrent, isoCurrencyCode } = result.data;
    const ctx = await requirePermission(organizationId, "account.write.own");

    const account = await prisma.financialAccount.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        name,
        type,
        balanceCurrent: toCents(balanceCurrent),
        isoCurrencyCode,
      },
    });

    await netWorthQueue.add(
      "snapshot",
      { organizationId: ctx.organizationId, userId: ctx.userId },
      { jobId: `snapshot-${ctx.organizationId}-${Date.now()}` }
    );

    return Response.json(account, { status: 201 });
  });
}
