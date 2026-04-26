import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { CreateTransactionSchema } from "@repo/shared/schemas";
import { toCents } from "@repo/shared/money";
import { budgetQueue } from "@/lib/queues";

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = CreateTransactionSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid request body", issues: result.error.issues }, { status: 400 });
    }

    const { financialAccountId, organizationId, amount, name, date, customCategory, merchantName, pending, isoCurrencyCode } = result.data;
    const ctx = await requirePermission(organizationId, "transaction.write.own");

    const transaction = await prisma.transaction.create({
      data: {
        financialAccountId,
        organizationId: ctx.organizationId,
        amount: toCents(amount),
        isoCurrencyCode,
        date: new Date(date),
        name,
        merchantName: merchantName ?? null,
        customCategory: customCategory ?? null,
        pending,
      },
    });

    const txDate = new Date(date);
    await budgetQueue.add(
      "aggregate",
      {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        month: txDate.getUTCMonth() + 1,
        year: txDate.getUTCFullYear(),
      },
      { jobId: `budget-${ctx.organizationId}-${txDate.getUTCFullYear()}-${txDate.getUTCMonth() + 1}` }
    );

    return Response.json(transaction, { status: 201 });
  });
}
