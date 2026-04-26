import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { InsightFeedback } from "@/components/insight-feedback";
import { TriggerInsightButton } from "@/components/trigger-insight-button";
import { Lightbulb, AlertTriangle, Info } from "lucide-react";

const SEVERITY_BADGE = {
  info: { variant: "secondary" as const, Icon: Info },
  warning: { variant: "warning" as const, Icon: AlertTriangle },
  critical: { variant: "destructive" as const, Icon: AlertTriangle },
};

const TYPE_LABELS: Record<string, string> = {
  spending_anomaly: "Spending Anomaly",
  subscription_audit: "Subscriptions",
  goal_pacing: "Goal Pacing",
  savings_opportunity: "Savings",
  budget_breach_forecast: "Budget Alert",
};

export default async function InsightsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const insights = await prisma.insight.findMany({
    where: { organizationId: org.id, userId: session.user.id, expiresAt: { gt: new Date() } },
    orderBy: { generatedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Insights</h1>
          <p className="text-sm text-muted-foreground">Personalized financial analysis powered by Claude</p>
        </div>
        <TriggerInsightButton orgId={org.id} />
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Lightbulb className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="font-semibold">No insights yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Insights are generated automatically after syncing. You can also request one now.
            </p>
            <TriggerInsightButton orgId={org.id} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const { variant, Icon } = SEVERITY_BADGE[insight.severity as keyof typeof SEVERITY_BADGE] ?? SEVERITY_BADGE.info;
            return (
              <Card key={insight.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <CardTitle className="text-base">{insight.title}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {TYPE_LABELS[insight.type] ?? insight.type} · {formatDate(insight.generatedAt)}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={variant} className="shrink-0">{insight.severity}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-relaxed">{insight.body}</p>
                  {insight.actionItems.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Action items</p>
                      <ul className="space-y-1">
                        {insight.actionItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <InsightFeedback insightId={insight.id} helpful={insight.helpful} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
