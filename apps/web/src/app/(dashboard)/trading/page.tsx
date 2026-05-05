import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import {
  BarChart3, TrendingUp, TrendingDown, Minus,
  Building2, ArrowUpRight, ArrowDownRight, HeartPulse,
} from "lucide-react";
import { AllocationChart } from "@/components/trading/allocation-chart";
import { HealthReportButton } from "@/components/trading/health-report-button";

const SUBTYPE_LABELS: Record<string, string> = {
  brokerage: "Brokerage",
  ira: "IRA",
  roth_ira: "Roth IRA",
  "401k": "401(k)",
  crypto: "Crypto",
};

export default async function TradingPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId: org.id, type: "investment" },
    orderBy: { name: "asc" },
    include: {
      holdings: {
        orderBy: { institutionValue: "desc" },
        include: {
          security: {
            select: { name: true, tickerSymbol: true, type: true, closePrice: true, closePriceAsOf: true },
          },
        },
      },
    },
  });

  // Portfolio totals
  let totalValueCents = 0n;
  let totalCostBasisCents = 0n;
  let hasCostBasis = false;

  const enrichedAccounts = accounts.map((account) => {
    const accountValueCents = account.holdings.reduce((s, h) => s + h.institutionValue, 0n);
    totalValueCents += accountValueCents;

    const holdings = account.holdings.map((h) => {
      const valueCents = h.institutionValue;
      const costBasisCents = h.costBasis;
      const unrealizedGL = h.unrealizedGainLoss
        ? h.unrealizedGainLoss
        : costBasisCents !== null
          ? valueCents - costBasisCents
          : null;
      if (costBasisCents) { hasCostBasis = true; totalCostBasisCents += costBasisCents; }
      return { ...h, valueCents, costBasisCents, unrealizedGL };
    });

    return { ...account, accountValueCents, holdings };
  });

  const totalValue = totalValueCents;
  const unrealizedGL = hasCostBasis ? totalValue - totalCostBasisCents : null;
  const gainLossPct = unrealizedGL !== null && totalCostBasisCents > 0n
    ? Number(unrealizedGL) / Number(totalCostBasisCents) * 100
    : null;

  // Asset class breakdown for the chart
  const assetClassMap = new Map<string, bigint>();
  for (const account of enrichedAccounts) {
    for (const h of account.holdings) {
      const cls = h.security.type || "other";
      assetClassMap.set(cls, (assetClassMap.get(cls) ?? 0n) + h.valueCents);
    }
  }
  const allocationData = Array.from(assetClassMap.entries()).map(([name, valueCents]) => ({
    name,
    valueCents: Number(valueCents),
    allocationPercent: totalValue > 0n ? Number(valueCents) / Number(totalValue) * 100 : 0,
  })).sort((a, b) => b.valueCents - a.valueCents);

  const totalHoldings = accounts.reduce((s, a) => s + a.holdings.length, 0);

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-sky-500" />
            Trading & Investments
          </h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} · {totalHoldings} position{totalHoldings !== 1 ? "s" : ""}
          </p>
        </div>
        <HealthReportButton orgId={org.id} />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-600/70">Portfolio Value</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-sky-950 tabular-nums">
              {accounts.length > 0 ? formatCents(totalValue) : "—"}
            </p>
            <p className="mt-1 text-xs font-medium text-sky-500/70">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 opacity-40" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-600/70">Unrealized P&amp;L</p>
            {unrealizedGL !== null ? (
              <>
                <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${unrealizedGL >= 0n ? "text-emerald-600" : "text-rose-500"}`}>
                  {unrealizedGL >= 0n ? "+" : "−"}{formatCents(unrealizedGL < 0n ? -unrealizedGL : unrealizedGL)}
                </p>
                {gainLossPct !== null && (
                  <div className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${gainLossPct >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                    {gainLossPct >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {Math.abs(gainLossPct).toFixed(2)}% from cost basis
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-2xl font-bold tracking-tight text-sky-950 tabular-nums">—</p>
                <p className="mt-1 text-xs font-medium text-sky-500/70">Add cost basis to track</p>
              </>
            )}
          </CardContent>
          <div className={`absolute bottom-0 left-0 right-0 h-0.5 opacity-40 ${unrealizedGL !== null && unrealizedGL >= 0n ? "bg-emerald-500" : unrealizedGL !== null ? "bg-rose-500" : "bg-sky-500"}`} />
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-600/70">Positions</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-sky-950 tabular-nums">{totalHoldings}</p>
            <p className="mt-1 text-xs font-medium text-sky-500/70">{allocationData.length} asset class{allocationData.length !== 1 ? "es" : ""}</p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 opacity-40" />
        </Card>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="mb-3 h-12 w-12 text-sky-200" />
            <p className="text-base font-semibold text-sky-700">No investment accounts yet</p>
            <p className="mt-1 text-sm text-sky-500/70">
              Connect a brokerage, IRA, 401(k), or crypto account to start tracking your portfolio.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">

          {/* Holdings table — wide */}
          <div className="space-y-4 lg:col-span-3">
            {enrichedAccounts.map((account) => (
              <Card key={account.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 text-sky-500" />
                      {account.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {account.subtype && (
                        <Badge variant="secondary" className="text-[10px]">
                          {SUBTYPE_LABELS[account.subtype] ?? account.subtype}
                        </Badge>
                      )}
                      <span className="text-sm font-bold text-sky-950 tabular-nums">
                        {formatCents(account.accountValueCents)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  {account.holdings.length === 0 ? (
                    <p className="px-6 pb-4 text-xs text-sky-500/70">No holdings in this account.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-sky-50">
                            <th className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-widest text-sky-600/60">Security</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-widest text-sky-600/60">Qty</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-widest text-sky-600/60">Value</th>
                            <th className="px-6 py-2 text-right text-xs font-semibold uppercase tracking-widest text-sky-600/60">P&amp;L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sky-50">
                          {account.holdings.map((h) => {
                            const glPositive = h.unrealizedGL !== null && h.unrealizedGL >= 0n;
                            return (
                              <tr key={h.id} className="transition-colors hover:bg-sky-50/50">
                                <td className="px-6 py-3">
                                  <p className="font-semibold text-sky-950">
                                    {h.security.tickerSymbol ?? h.security.name}
                                  </p>
                                  <p className="text-xs text-sky-500/70 truncate max-w-[180px]">
                                    {h.security.tickerSymbol ? h.security.name : h.security.type}
                                  </p>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-sky-700">
                                  {Number(h.quantity).toLocaleString("en-US", { maximumFractionDigits: 4 })}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-sky-950">
                                  {formatCents(h.valueCents)}
                                </td>
                                <td className="px-6 py-3 text-right">
                                  {h.unrealizedGL !== null ? (
                                    <div className={`flex items-center justify-end gap-1 font-semibold tabular-nums ${glPositive ? "text-emerald-600" : "text-rose-500"}`}>
                                      {glPositive
                                        ? <TrendingUp className="h-3.5 w-3.5" />
                                        : <TrendingDown className="h-3.5 w-3.5" />}
                                      {glPositive ? "+" : "−"}
                                      {formatCents(h.unrealizedGL < 0n ? -h.unrealizedGL : h.unrealizedGL)}
                                    </div>
                                  ) : (
                                    <Minus className="ml-auto h-3.5 w-3.5 text-sky-300" />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Allocation chart — narrow */}
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">Asset Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationChart data={allocationData} />
                <div className="mt-2 space-y-1.5">
                  {allocationData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="font-medium capitalize text-sky-700">
                        {d.name.replace(/_/g, " ")}
                      </span>
                      <div className="flex gap-3 tabular-nums">
                        <span className="text-sky-500/70">{d.allocationPercent.toFixed(1)}%</span>
                        <span className="font-semibold text-sky-950">{formatCents(d.valueCents)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Health report prompt */}
            <Card className="border-violet-200 bg-violet-50/50">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
                  <div>
                    <p className="text-sm font-semibold text-violet-900">Financial Health Report</p>
                    <p className="mt-1 text-xs text-violet-700/70">
                      Get an AI-powered assessment of your financial strengths, areas of concern, and personalized recommendations.
                    </p>
                    <div className="mt-3">
                      <HealthReportButton orgId={org.id} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
