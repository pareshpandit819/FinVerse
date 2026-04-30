"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { AlertRuleManager } from "@/components/alert-rule-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Info, AlertCircle } from "lucide-react";

interface AlertHistoryItem {
  id: string;
  alertRule: {
    name: string;
    ruleType: string;
  };
  message: string;
  triggerValue: number | null;
  wasViewed: boolean;
  triggeredAt: string;
}

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const sessionOrgId = (session as any)?.user?.organizationId;
    setOrgId(sessionOrgId);
  }, [session]);

  useEffect(() => {
    if (orgId) {
      fetchAlertHistory();
    }
  }, [orgId]);

  async function fetchAlertHistory() {
    if (!orgId) return;
    try {
      const response = await fetch(`/api/alerts/history?orgId=${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setAlertHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch alert history:", error);
    }
  }

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  if (!orgId) {
    return <div>Loading organization...</div>;
  }

  const unreadCount = alertHistory.filter((a) => !a.wasViewed).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alerts & Thresholds</h1>
        <p className="text-muted-foreground mt-2">
          Get notified when important financial events occur
        </p>
      </div>

      {unreadCount > 0 && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-200">
            {unreadCount} Unread Alert{unreadCount !== 1 ? "s" : ""}
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-300">
            You have {unreadCount} unread alert{unreadCount !== 1 ? "s" : ""}. Check the history below to review them.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Custom Alerts</AlertTitle>
        <AlertDescription>
          Create rules to monitor your spending, budgets, transactions, and bills. Receive notifications via email or in-app.
        </AlertDescription>
      </Alert>

      <AlertRuleManager organizationId={orgId} />

      <Card>
        <CardHeader>
          <CardTitle>Recent Alert History</CardTitle>
          <CardDescription>
            Last 50 triggered alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No alerts triggered yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {alertHistory.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 border rounded-lg ${
                    alert.wasViewed ? "bg-muted/50" : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                  } transition`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{alert.alertRule.name}</p>
                        {!alert.wasViewed && (
                          <Badge variant="default" className="text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{alert.message}</p>
                      {alert.triggerValue && (
                        <p className="text-xs text-muted-foreground">
                          Trigger value: ${(alert.triggerValue / 100).toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.triggeredAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alert Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Budget Breach</h3>
            <p className="text-sm text-muted-foreground">
              Triggered when spending exceeds your budget limits for a category
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Spending Threshold</h3>
            <p className="text-sm text-muted-foreground">
              Triggered when daily or monthly spending exceeds a custom amount
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Large Transaction</h3>
            <p className="text-sm text-muted-foreground">
              Triggered when a single transaction exceeds a specified amount
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Bill Due</h3>
            <p className="text-sm text-muted-foreground">
              Triggered when a bill payment is due soon or overdue
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
