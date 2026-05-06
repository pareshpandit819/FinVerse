"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Repeat, CalendarClock, DollarSign, RotateCw, RefreshCw } from "lucide-react";
import { formatCentsNumber, formatDate } from "@/lib/format";

interface Subscription {
  merchantName: string;
  displayName: string;
  estimatedMonthlyCents: number;
  lastSeenDate: string;
  transactionCount: number;
  tagged: boolean;
}

interface RecurringData {
  subscriptions: Subscription[];
  totalMonthlyCents: number;
}

export default function RecurringPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [data, setData] = useState<RecurringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tagging, setTagging] = useState(false);

  useEffect(() => {
    fetch("/api/org/active")
      .then((r) => r.json())
      .then((json) => setOrgId(json?.org?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    fetch(`/api/recurring?orgId=${orgId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  async function tagAll() {
    if (!orgId || !data) return;
    const untagged = data.subscriptions.filter((s) => !s.tagged).map((s) => s.displayName);
    if (untagged.length === 0) return;
    setTagging(true);
    try {
      await fetch("/api/recurring/tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, merchantNames: untagged }),
      });
      const res = await fetch(`/api/recurring?orgId=${orgId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setTagging(false);
    }
  }

  if (loading || !orgId) {
    return (
      <div className="flex items-center justify-center p-20 text-sky-600/50">
        <RotateCw className="mr-2 h-5 w-5 animate-spin" />
        Detecting recurring transactions…
      </div>
    );
  }

  if (!data || data.subscriptions.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">Recurring Transactions</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">
            Auto-detected subscriptions and recurring charges
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
              <Repeat className="h-7 w-7 text-sky-500" />
            </div>
            <h3 className="font-semibold text-sky-950">No recurring transactions detected</h3>
            <p className="mt-1.5 text-sm text-sky-600/70">
              We scan for charges from the same merchant with similar amounts over the last 90 days.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const untaggedCount = data.subscriptions.filter((s) => !s.tagged).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">Recurring Transactions</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">
            {data.subscriptions.length} subscription
            {data.subscriptions.length !== 1 ? "s" : ""} detected in the last 90 days
          </p>
        </div>
        {untaggedCount > 0 && (
          <Button
            onClick={tagAll}
            disabled={tagging}
            size="sm"
            className="bg-sky-500 text-white hover:bg-sky-600"
          >
            {tagging ? (
              <RotateCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Tag {untaggedCount} as Subscriptions
          </Button>
        )}
      </div>

      {/* Total cost summary */}
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100">
            <DollarSign className="h-6 w-6 text-sky-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-sky-600/70">
              Estimated Monthly Subscription Cost
            </p>
            <p className="text-2xl font-bold tabular-nums text-sky-950">
              {formatCentsNumber(data.totalMonthlyCents)}
            </p>
            <p className="text-xs text-sky-600/60">
              Based on charge frequency over the last 90 days
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Subscription list */}
      <div className="space-y-3">
        {data.subscriptions.map((sub) => (
          <div
            key={sub.merchantName}
            className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-sky-100/50"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold capitalize text-sky-950">
                    {sub.displayName}
                  </p>
                  {sub.tagged && (
                    <Badge variant="success" className="shrink-0 text-[10px]">
                      Tagged
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-600/70">
                  <span className="flex items-center gap-1">
                    <Repeat className="h-3 w-3" />
                    {sub.transactionCount}× in 90 days
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    Last: {formatDate(sub.lastSeenDate)}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums text-sky-950">
                  {formatCentsNumber(sub.estimatedMonthlyCents)}
                </p>
                <p className="text-xs text-sky-600/60">/mo</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
