import { NextResponse } from "next/server";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { prisma } from "@repo/db/client";

// GET /api/trading?orgId=<uuid>
// Returns all investment accounts with their holdings and securities.
export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePermission(orgId, "account.read.own");

    const accounts = await prisma.financialAccount.findMany({
      where: { organizationId: orgId, type: "investment" },
      orderBy: { name: "asc" },
      include: {
        holdings: {
          orderBy: { institutionValue: "desc" },
          include: {
            security: {
              select: {
                name: true,
                tickerSymbol: true,
                type: true,
                closePrice: true,
                closePriceAsOf: true,
              },
            },
          },
        },
      },
    });

    // Compute portfolio totals
    let totalValueCents = 0n;
    let totalCostBasisCents = 0n;
    let hasCostBasis = false;

    const enriched = accounts.map((account) => {
      const accountValueCents = account.holdings.reduce(
        (sum, h) => sum + h.institutionValue,
        0n
      );
      totalValueCents += accountValueCents;

      const holdings = account.holdings.map((h) => {
        const valueCents = Number(h.institutionValue);
        const costBasisCents = h.costBasis ? Number(h.costBasis) : null;
        const unrealizedGainLoss = h.unrealizedGainLoss
          ? Number(h.unrealizedGainLoss)
          : costBasisCents !== null
            ? valueCents - costBasisCents
            : null;

        if (h.costBasis) {
          hasCostBasis = true;
          totalCostBasisCents += h.costBasis;
        }

        return {
          id: h.id,
          ticker: h.security.tickerSymbol,
          name: h.security.name,
          securityType: h.security.type,
          quantity: Number(h.quantity),
          valueCents,
          costBasisCents,
          unrealizedGainLossCents: unrealizedGainLoss,
          dayChangeCents: h.dayChange ? Number(h.dayChange) : null,
          closePrice: h.security.closePrice ? Number(h.security.closePrice) : null,
          closePriceAsOf: h.security.closePriceAsOf?.toISOString().split("T")[0] ?? null,
        };
      });

      return {
        id: account.id,
        name: account.name,
        subtype: account.subtype,
        valueCents: Number(accountValueCents),
        holdings,
      };
    });

    const totalValue = Number(totalValueCents);
    const totalCost = Number(totalCostBasisCents);
    const unrealizedGainLoss = hasCostBasis ? totalValue - totalCost : null;

    // Asset class breakdown across all holdings
    const assetClassBreakdown: Record<string, { valueCents: number; allocationPercent: number }> = {};
    for (const account of enriched) {
      for (const h of account.holdings) {
        const cls = h.securityType || "other";
        if (!assetClassBreakdown[cls]) assetClassBreakdown[cls] = { valueCents: 0, allocationPercent: 0 };
        assetClassBreakdown[cls]!.valueCents += h.valueCents;
      }
    }
    for (const cls of Object.keys(assetClassBreakdown)) {
      assetClassBreakdown[cls]!.allocationPercent =
        totalValue > 0
          ? Math.round((assetClassBreakdown[cls]!.valueCents / totalValue) * 10000) / 100
          : 0;
    }

    return NextResponse.json({
      accounts: enriched,
      summary: {
        totalValueCents: totalValue,
        totalCostBasisCents: hasCostBasis ? totalCost : null,
        unrealizedGainLossCents: unrealizedGainLoss,
        gainLossPercent:
          unrealizedGainLoss !== null && totalCost > 0
            ? Math.round((unrealizedGainLoss / totalCost) * 10000) / 100
            : null,
        accountCount: accounts.length,
        totalHoldings: accounts.reduce((s, a) => s + a.holdings.length, 0),
      },
      assetClassBreakdown,
    });
  });
}
