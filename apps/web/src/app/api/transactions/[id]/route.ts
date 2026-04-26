import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";

export function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthErrors(async () => {
    const { id } = await params;

    const existing = await prisma.transaction.findUnique({
      where: { id },
      include: { account: { select: { userId: true } } },
    });
    if (!existing) return Response.json({ error: "Transaction not found" }, { status: 404 });

    const ctx = await requirePermission(existing.organizationId, "transaction.write.own");

    if (existing.account.userId !== ctx.userId) {
      await requirePermission(existing.organizationId, "transaction.write.any");
    }

    await prisma.transaction.delete({ where: { id } });

    return new Response(null, { status: 204 });
  });
}
