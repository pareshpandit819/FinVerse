"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { SpendingForecastChart } from "@/components/spending-forecast-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Info } from "lucide-react";

export default function ForecastPage() {
  const { data: session, status } = useSession();
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const sessionOrgId = (session as any)?.user?.organizationId;
    setOrgId(sessionOrgId);
  }, [session]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  if (!orgId) {
    return <div>Loading organization...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Spending Forecast</h1>
        <p className="text-muted-foreground mt-2">
          AI-powered predictions of your future spending based on historical patterns
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Data-Driven Predictions</AlertTitle>
        <AlertDescription>
          Our forecasting algorithm analyzes your spending history (past 90 days) to predict future spending patterns with confidence intervals.
        </AlertDescription>
      </Alert>

      <SpendingForecastChart organizationId={orgId} />

      <Card>
        <CardHeader>
          <CardTitle>How Forecasting Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">1. Historical Analysis</h3>
            <p className="text-sm text-muted-foreground">
              We analyze your last 90 days of transactions to identify spending patterns and trends.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">2. Trend Calculation</h3>
            <p className="text-sm text-muted-foreground">
              The system calculates spending trends, seasonal patterns, and computes statistical confidence intervals.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">3. Future Projection</h3>
            <p className="text-sm text-muted-foreground">
              Using linear regression and trend analysis, we project your spending forward for the selected period (monthly, quarterly, or annual).
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">4. Confidence Scoring</h3>
            <p className="text-sm text-muted-foreground">
              Each forecast includes a confidence score based on data consistency. Higher scores indicate more reliable predictions.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Forecast Confidence Levels</CardTitle>
          <CardDescription>
            What the confidence score means
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950">
            <div>
              <p className="font-semibold text-green-900 dark:text-green-200">High (80-100%)</p>
              <p className="text-sm text-green-800 dark:text-green-300">Spending patterns are consistent and predictable</p>
            </div>
            <span className="text-xl font-bold text-green-600">✓</span>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
            <div>
              <p className="font-semibold text-yellow-900 dark:text-yellow-200">Medium (60-80%)</p>
              <p className="text-sm text-yellow-800 dark:text-yellow-300">Some variability but generally predictable</p>
            </div>
            <span className="text-xl font-bold text-yellow-600">≈</span>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 dark:bg-orange-950">
            <div>
              <p className="font-semibold text-orange-900 dark:text-orange-200">Low (&lt;60%)</p>
              <p className="text-sm text-orange-800 dark:text-orange-300">High variability - use with caution</p>
            </div>
            <span className="text-xl font-bold text-orange-600">?</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Using Forecasts for Planning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span><strong>Budget Planning:</strong> Use monthly forecasts to set realistic budget targets</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span><strong>Savings Goals:</strong> Compare projected spending to income to calculate achievable savings</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span><strong>Cash Flow Management:</strong> Anticipate seasonal spending patterns and plan accordingly</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span><strong>Alert Thresholds:</strong> Set up spending alerts based on forecast predictions</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span><strong>Financial Goals:</strong> Adjust contribution rates to goals based on spending projections</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
