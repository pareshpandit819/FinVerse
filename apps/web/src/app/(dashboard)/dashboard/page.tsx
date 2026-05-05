import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatCents, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Minus,
  Landmark, ArrowUpRight, ArrowDownRight,
  Target, Wallet, ReceiptText, BarChart3,
  HeartPulse, AlertTriangle, CheckCircle2, ChevronRight,
} from "lucide-react";

const ASSET_TYPES = new Set(["checking", "savings", "investment"]);

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export default async function DashboardPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const [latestSnapshot, accounts, recentTransactions, activeGoals, investmentAccounts, latestHealthReport] = await Promise.all([
    prisma.netWorthSnapshot.findFirst({
      where: { organizationId: org.id },
      orderBy: { snapshotDate: "desc" },
    }),
    prisma.financialAccount.findMany({
      where: { organizationId: org.id },
      orderBy: { type: "asc" },
    }),
    prisma.transaction.findMany({
      where: { organizationId: org.id },
      orderBy: { date: "desc" },
      take: 7,
      include: { account: { select: { name: true } } },
    }),
    prisma.goal.count({ where: { organizationId: org.id, isCompleted: false } }),
    prisma.financialAccount.findMany({
      where: { organizationId: org.id, type: "investment" },
      select: { id: true, name: true, subtype: true, balanceCurrent: true, holdings: { select: { institutionValue: true } } },
    }),
    prisma.insight.findFirst({
      where: { organizationId: org.id, userId: session.user.id, type: "financial_health_report", expiresAt: { gt: new Date() } },
      orderBy: { generatedAt: "desc" },
      select: { id: true, title: true, severity: true, metadata: true, generatedAt: true },
    }),
  ]);

  const prevSnapshot = latestSnapshot
    ? await prisma.netWorthSnapshot.findFirst({
        where: { organizationId: org.id, snapshotDate: { lt: latestSnapshot.snapshotDate } },
        orderBy: { snapshotDate: "desc" },
      })
    : null;

  const netWorthChange = latestSnapshot && prevSnapshot
    ? latestSnapshot.netWorth - prevSnapshot.netWorth
    : null;

  const assetAccounts  = accounts.filter(a =>  ASSET_TYPES.has(a.type));
  const liabAccounts   = accounts.filter(a => !ASSET_TYPES.has(a.type));
  const totalAssets    = assetAccounts.reduce((s, a) => s + a.balanceCurrent, 0n);
  const totalLiabs     = liabAccounts.reduce((s, a) => s + a.balanceCurrent, 0n);

  // Portfolio totals from holdings (more precise than account balance for investment accounts)
  const portfolioValueCents = investmentAccounts.reduce((sum, acct) => {
    const holdingsTotal = acct.holdings.reduce((s, h) => s + h.institutionValue, 0n);
    return sum + (holdingsTotal > 0n ? holdingsTotal : acct.balanceCurrent);
  }, 0n);
  const totalHoldings = investmentAccounts.reduce((s, a) => s + a.holdings.length, 0);

  // Parse health report metadata
  type HealthMeta = {
    healthScore?: number;
    concerns?: Array<{ title: string; severity: string }>;
    strengths?: Array<{ title: string }>;
  };
  const healthMeta = latestHealthReport?.metadata as HealthMeta | null;

  const kpis = [
    {
      label: "Net Worth",
      value: latestSnapshot ? formatCents(latestSnapshot.netWorth) : "—",
      change: netWorthChange,
      icon: TrendingUp,
      iconBg: "bg-sky-500",
      iconRing: "ring-sky-200",
    },
    {
      label: "Total Assets",
      value: formatCents(totalAssets),
      sub: `${assetAccounts.length} account${assetAccounts.length !== 1 ? "s" : ""}`,
      icon: Landmark,
      iconBg: "bg-emerald-500",
      iconRing: "ring-emerald-200",
    },
    {
      label: "Liabilities",
      value: formatCents(totalLiabs),
      sub: `${liabAccounts.length} account${liabAccounts.length !== 1 ? "s" : ""}`,
      icon: Wallet,
      iconBg: "bg-rose-400",
      iconRing: "ring-rose-200",
    },
    {
      label: "Active Goals",
      value: String(activeGoals),
      sub: "In progress",
      icon: Target,
      iconBg: "bg-violet-500",
      iconRing: "ring-violet-200",
    },
  ];

  return (
    <div className="space-y-6 p-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sky-950">
          Good {getGreeting()}, {(session.user.name ?? session.user.email ?? "").split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm font-medium text-sky-600/70">
          Here&apos;s an overview of your finances today.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-sky-600/70">
                    {k.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-sky-950 tabular-nums">
                    {k.value}
                  </p>

                  {k.change !== null && k.change !== undefined ? (
                    <div className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${k.change >= 0n ? "text-emerald-600" : "text-rose-500"}`}>
                      {k.change > 0n
                        ? <ArrowUpRight className="h-3.5 w-3.5" />
                        : k.change < 0n
                          ? <ArrowDownRight className="h-3.5 w-3.5" />
                          : <Minus className="h-3.5 w-3.5" />}
                      {formatCents(k.change < 0n ? -k.change : k.change)} vs last
                    </div>
                  ) : k.sub ? (
                    <p className="mt-1.5 text-xs font-medium text-sky-500/70">{k.sub}</p>
                  ) : null}
                </div>

                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${k.iconBg} ring-4 ${k.iconRing} shadow-sm`}>
                  <k.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
            {/* accent stripe */}
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${k.iconBg} opacity-40`} />
          </Card>
        ))}
      </div>

      {/* Lower grid */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Recent transactions — wider */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-sky-500" />
                Recent Transactions
              </CardTitle>
              <Badge variant="secondary">{recentTransactions.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {recentTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ReceiptText className="mb-3 h-9 w-9 text-sky-200" />
                <p className="text-sm font-medium text-sky-700">No transactions yet.</p>
                <p className="mt-1 text-xs text-sky-500/70">Add an account and log your first transaction.</p>
              </div>
            ) : (
              <div className="divide-y divide-sky-50">
                {recentTransactions.map((txn) => {
                  const isIncome = txn.amount < 0n;
                  return (
                    <div
                      key={txn.id}
                      className="flex items-center justify-between px-6 py-3 transition-colors duration-150 hover:bg-sky-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-sky-950">{txn.name}</p>
                        <p className="mt-0.5 text-xs font-medium text-sky-600/60">
                          {txn.account.name} · {formatDate(txn.date)}
                        </p>
                      </div>
                      <div className="ml-4 shrink-0 text-right">
                        <p className={`text-sm font-bold tabular-nums tracking-tight ${isIncome ? "text-emerald-600" : "text-sky-950"}`}>
                          {isIncome ? "+" : "−"}{formatCents(txn.amount < 0n ? -txn.amount : txn.amount)}
                        </p>
                        {txn.customCategory && (
                          <Badge variant="secondary" className="mt-0.5 py-0 text-[10px]">
                            {txn.customCategory}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accounts summary — narrower */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-sky-500" />
                Accounts
              </CardTitle>
              <Badge variant="secondary">{accounts.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Landmark className="mb-3 h-9 w-9 text-sky-200" />
                <p className="text-sm font-medium text-sky-700">No accounts yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-sky-50">
                {accounts.slice(0, 6).map((acc) => {
                  const isLiab = !ASSET_TYPES.has(acc.type);
                  return (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between px-6 py-3 transition-colors duration-150 hover:bg-sky-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-sky-950">{acc.name}</p>
                        <p className="mt-0.5 text-xs font-medium capitalize text-sky-600/60">
                          {acc.type.replace("_", " ")}
                        </p>
                      </div>
                      <p className={`ml-3 shrink-0 text-sm font-bold tabular-nums tracking-tight ${isLiab ? "text-rose-500" : "text-emerald-600"}`}>
                        {isLiab ? "−" : ""}{formatCents(acc.balanceCurrent)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio + Health report row */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Portfolio summary */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-sky-500" />
                Investment Portfolio
              </CardTitle>
              <Link href="/trading" className="flex items-center gap-1 text-xs font-semibold text-sky-500 hover:text-sky-700 transition-colors">
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {investmentAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="mb-2 h-8 w-8 text-sky-200" />
                <p className="text-sm font-medium text-sky-700">No investment accounts</p>
                <p className="mt-0.5 text-xs text-sky-500/70">Connect a brokerage or IRA to track your portfolio.</p>
                <Link href="/accounts" className="mt-3 text-xs font-semibold text-sky-500 hover:underline">
                  Add account →
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-sky-950 tabular-nums">
                      {formatCents(portfolioValueCents)}
                    </p>
                    <p className="mt-0.5 text-xs text-sky-500/70">
                      {investmentAccounts.length} account{investmentAccounts.length !== 1 ? "s" : ""} · {totalHoldings} position{totalHoldings !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {investmentAccounts.slice(0, 4).map((acct) => {
                    const val = acct.holdings.reduce((s, h) => s + h.institutionValue, 0n);
                    const displayVal = val > 0n ? val : acct.balanceCurrent;
                    const pct = portfolioValueCents > 0n ? Number(displayVal) / Number(portfolioValueCents) * 100 : 0;
                    return (
                      <div key={acct.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-sky-800 truncate max-w-[180px]">{acct.name}</span>
                          <span className="font-semibold text-sky-950 tabular-nums">{formatCents(displayVal)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-sky-100">
                          <div
                            className="h-1.5 rounded-full bg-sky-500 transition-all"
                            style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Financial health summary */}
        <Card className={`relative overflow-hidden ${latestHealthReport ? "border-violet-200" : ""}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-violet-500" />
                Financial Health
              </CardTitle>
              {latestHealthReport && (
                <Link href="/insights" className="flex items-center gap-1 text-xs font-semibold text-violet-500 hover:text-violet-700 transition-colors">
                  Full report <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!latestHealthReport ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <HeartPulse className="mb-2 h-8 w-8 text-violet-200" />
                <p className="text-sm font-medium text-sky-700">No health report yet</p>
                <p className="mt-0.5 text-xs text-sky-500/70">
                  Generate a report to see concerns, strengths, and recommendations.
                </p>
                <Link href="/trading" className="mt-3 text-xs font-semibold text-violet-500 hover:underline">
                  Generate report →
                </Link>
              </div>
            ) : (
              <>
                {/* Health score */}
                {healthMeta?.healthScore !== undefined && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm
                      ${healthMeta.healthScore >= 80 ? "bg-emerald-500 shadow-emerald-400/30" : healthMeta.healthScore >= 60 ? "bg-amber-500 shadow-amber-400/30" : "bg-rose-500 shadow-rose-400/30"}`}>
                      {healthMeta.healthScore}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-sky-950">{latestHealthReport.title}</p>
                      <p className="mt-0.5 text-xs text-sky-500/70">
                        Score out of 100 · {healthMeta.healthScore >= 80 ? "Excellent" : healthMeta.healthScore >= 60 ? "Good" : "Needs attention"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Top concern */}
                {healthMeta?.concerns && healthMeta.concerns.length > 0 && (
                  <div className="mb-2 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-rose-700">Top concern</p>
                      <p className="text-xs text-rose-600/80 truncate">{healthMeta.concerns[0]!.title}</p>
                    </div>
                    {healthMeta.concerns.length > 1 && (
                      <Badge variant="secondary" className="ml-auto shrink-0 text-[10px] bg-rose-100 text-rose-600">
                        +{healthMeta.concerns.length - 1}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Top strength */}
                {healthMeta?.strengths && healthMeta.strengths.length > 0 && (
                  <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-emerald-700">Top strength</p>
                      <p className="text-xs text-emerald-600/80 truncate">{healthMeta.strengths[0]!.title}</p>
                    </div>
                    {healthMeta.strengths.length > 1 && (
                      <Badge variant="secondary" className="ml-auto shrink-0 text-[10px] bg-emerald-100 text-emerald-600">
                        +{healthMeta.strengths.length - 1}
                      </Badge>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
