import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    await requirePermission(orgId, "data.read.own");

    const taxYear = new Date().getFullYear();
    const yearStart = new Date(taxYear, 0, 1);
    const yearEnd = new Date(taxYear, 11, 31);

    // Income = negative-amount transactions (deposits/income in this codebase's convention)
    const incomeTxns = await prisma.transaction.findMany({
      where: {
        organizationId: orgId,
        date: { gte: yearStart, lte: yearEnd },
        pending: false,
        amount: { lt: 0n },
      },
      select: { amount: true },
    });

    const estimatedIncomeCents = incomeTxns.reduce(
      (sum, t) => sum + Math.abs(Number(t.amount)),
      0
    );

    // Unrealized gains from investment holdings
    const holdings = await prisma.holding.findMany({
      where: { organizationId: orgId },
      select: { institutionValue: true, costBasis: true, unrealizedGainLoss: true },
    });

    let unrealizedGainsCents = 0;
    let holdingsWithBasis = 0;

    for (const h of holdings) {
      let gain: number | null = null;
      if (h.unrealizedGainLoss != null) {
        gain = Number(h.unrealizedGainLoss);
      } else if (h.costBasis != null) {
        gain = Number(h.institutionValue) - Number(h.costBasis);
      }
      if (gain !== null) {
        unrealizedGainsCents += gain;
        holdingsWithBasis++;
      }
    }

    return Response.json({
      taxYear,
      estimatedIncomeCents,
      incomeTransactionCount: incomeTxns.length,
      unrealizedGainsCents,
      holdingsWithBasis,
      totalHoldings: holdings.length,
    });
  });
}
