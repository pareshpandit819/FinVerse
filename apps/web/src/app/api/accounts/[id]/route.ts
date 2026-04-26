import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { UpdateAccountSchema } from "@repo/shared/schemas";
import { toCents } from "@repo/shared/money";
import { netWorthQueue } from "@/lib/queues";

export function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthErrors(async () => {
    const { id } = await params;
    const body: unknown = await request.json().catch(() => null);
    const result = UpdateAccountSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid request body", issues: result.error.issues }, { status: 400 });
    }

    const existing = await prisma.financialAccount.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Account not found" }, { status: 404 });

    const ctx = await requirePermission(existing.organizationId, "account.write.own");

    if (existing.userId !== ctx.userId) {
      await requirePermission(existing.organizationId, "account.write.any");
    }

    const { name, balanceCurrent } = result.data;
    const account = await prisma.financialAccount.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(balanceCurrent !== undefined && { balanceCurrent: toCents(balanceCurrent) }),
      },
    });

    await netWorthQueue.add(
      "snapshot",
      { organizationId: ctx.organizationId, userId: ctx.userId },
      { jobId: `snapshot-${ctx.organizationId}-${Date.now()}` }
    );

    return Response.json(account);
  });
}

export function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthErrors(async () => {
    const { id } = await params;

    const existing = await prisma.financialAccount.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Account not found" }, { status: 404 });

    const ctx = await requirePermission(existing.organizationId, "account.write.own");

    if (existing.userId !== ctx.userId) {
      await requirePermission(existing.organizationId, "account.write.any");
    }

    await prisma.financialAccount.delete({ where: { id } });

    await netWorthQueue.add(
      "snapshot",
      { organizationId: ctx.organizationId, userId: ctx.userId },
      { jobId: `snapshot-${ctx.organizationId}-${Date.now()}` }
    );

    return new Response(null, { status: 204 });
  });
}
