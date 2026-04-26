import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { calculateBudget } from "@repo/shared/budget";
import { formatCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Progress } from "@repo/ui/progress";
import { PieChart } from "lucide-react";

export default async function BudgetsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const budget = await prisma.budget.findFirst({
    where: { organizationId: org.id, userId: session.user.id, month, year },
    include: { categories: { orderBy: { category: "asc" } } },
  });

  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });

  if (!budget) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">{monthName} {year}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <PieChart className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="font-semibold">No budget for this month</h3>
            <p className="text-sm text-muted-foreground mt-1">Create a budget to track spending by category.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const budgetResult = calculateBudget(
    budget.categories.map((c) => ({
      category: c.category,
      limitAmount: c.limitAmount,
      spentAmount: c.spentAmount,
      rolloverCarryIn: 0n,
    })),
    budget.rollover
  );

  const totalUtilPct = budgetResult.totalLimit > 0n
    ? Number((budgetResult.totalSpent * 100n) / budgetResult.totalLimit)
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">{budget.name} · {monthName} {year}</p>
        </div>
        <Badge variant={budgetResult.isBreached ? "destructive" : "success"}>
          {budgetResult.isBreached ? "Over budget" : "On track"}
        </Badge>
      </div>

      {/* Summary card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Spending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={totalUtilPct} className={totalUtilPct > 100 ? "[&>div]:bg-red-500" : ""} />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{totalUtilPct}% used</span>
            <span className="font-medium">
              {formatCents(budgetResult.totalSpent)} / {formatCents(budgetResult.totalLimit)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Category breakdown */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {budgetResult.categories.map((cat) => {
          const utilPct = Number(cat.utilizationBps) / 100;
          return (
            <Card key={cat.category}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{cat.category}</CardTitle>
                  {cat.isBreached && <Badge variant="destructive" className="text-xs">Over</Badge>}
                </div>
                <CardDescription className="text-xs">
                  {formatCents(cat.spentAmount)} of {formatCents(cat.effectiveLimit)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress
                  value={Math.min(utilPct, 100)}
                  className={cat.isBreached ? "[&>div]:bg-red-500" : utilPct > 80 ? "[&>div]:bg-yellow-500" : ""}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {cat.isBreached
                    ? `${formatCents(cat.overage)} over limit`
                    : `${formatCents(cat.remaining)} remaining`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
