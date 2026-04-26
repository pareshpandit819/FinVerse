import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { projectGoal } from "@repo/shared/goal";
import { formatCents, formatDate, formatBps } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Progress } from "@repo/ui/progress";
import { Target, CheckCircle2, AlertTriangle } from "lucide-react";

export default async function GoalsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const goals = await prisma.goal.findMany({
    where: { organizationId: org.id },
    orderBy: [{ isCompleted: "asc" }, { targetDate: "asc" }],
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
        <p className="text-sm text-muted-foreground">
          {goals.filter((g) => !g.isCompleted).length} active · {goals.filter((g) => g.isCompleted).length} completed
        </p>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="font-semibold">No goals yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Set financial goals to track your progress.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => {
            const monthlyRate = BigInt(Math.round(Number(goal.contributionRate)));
            const projection = projectGoal(
              { targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, targetDate: goal.targetDate },
              monthlyRate > 0n ? monthlyRate : undefined
            );

            const progressPct = Number(projection.progressBps) / 100;
            const isOnTrack = projection.isOnTrack;

            return (
              <Card key={goal.id} className={goal.isCompleted ? "opacity-75" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{goal.name}</CardTitle>
                    {goal.isCompleted ? (
                      <Badge variant="success" className="shrink-0"><CheckCircle2 className="mr-1 h-3 w-3" />Done</Badge>
                    ) : isOnTrack === true ? (
                      <Badge variant="success" className="shrink-0">On track</Badge>
                    ) : isOnTrack === false ? (
                      <Badge variant="warning" className="shrink-0"><AlertTriangle className="mr-1 h-3 w-3" />At risk</Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">In progress</Badge>
                    )}
                  </div>
                  <CardDescription>Target: {formatDate(goal.targetDate)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={progressPct} />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{formatBps(projection.progressBps)} saved</span>
                    <span className="font-medium">
                      {formatCents(goal.currentAmount)} / {formatCents(goal.targetAmount)}
                    </span>
                  </div>
                  {!goal.isCompleted && projection.daysRemaining > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {projection.daysRemaining} days remaining ·{" "}
                      {formatCents(projection.requiredMonthlyContribution)}/mo needed
                    </p>
                  )}
                  {projection.projectedCompletionDate && !goal.isCompleted && (
                    <p className="text-xs text-muted-foreground">
                      Projected completion: {formatDate(projection.projectedCompletionDate)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
