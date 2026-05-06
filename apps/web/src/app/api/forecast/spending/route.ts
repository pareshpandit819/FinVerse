import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { z } from "zod";
import { centsToDollars } from "@repo/shared/money";

const GenerateSpendingForecastInput = z.object({
  organizationId: z.string().uuid(),
  forecastType: z.enum(["monthly", "quarterly", "annual"]),
  category: z.string().optional(),
  daysLookback: z.number().default(90).min(30).max(365),
});

// Simple linear regression forecast
function calculateLinearForecast(
  historicalData: Array<{ date: Date; amount: number }>,
  forecastDays: number
): {
  forecast: Array<{
    date: string;
    amount: number;
    lower_bound: number;
    upper_bound: number;
  }>;
  confidence: number;
  predictedTotal: number;
} {
  if (historicalData.length < 2) {
    return {
      forecast: [],
      confidence: 0,
      predictedTotal: 0,
    };
  }

  // Calculate simple moving average and trend
  const amounts = historicalData.map((d) => d.amount);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  // Simple trend: last 30 days vs previous 30 days
  const recentAvg = amounts.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, amounts.length);
  const olderAvg = amounts.slice(0, Math.max(1, amounts.length - 30)).reduce((a, b) => a + b, 0) / Math.min(30, amounts.length);
  const trend = (recentAvg - olderAvg) / olderAvg;

  const forecast = [];
  let predictedTotal = 0;
  const startDate = new Date();

  for (let i = 1; i <= forecastDays; i++) {
    const projectedDate = new Date(startDate);
    projectedDate.setDate(projectedDate.getDate() + i);

    // Apply trend to mean
    const projectedAmount = recentAvg * (1 + trend * (i / 30));
    const lowerBound = Math.max(0, projectedAmount - 2 * stdDev);
    const upperBound = projectedAmount + 2 * stdDev;

    forecast.push({
      date: projectedDate.toISOString().split("T")[0],
      amount: Math.round(projectedAmount),
      lower_bound: Math.round(lowerBound),
      upper_bound: Math.round(upperBound),
    });

    predictedTotal += projectedAmount;
  }

  // Confidence based on data consistency
  const coefficient = stdDev / (mean || 1);
  const confidence = Math.max(0.3, Math.min(0.95, 1 - coefficient));

  return {
    forecast,
    confidence,
    predictedTotal: Math.round(predictedTotal),
  };
}

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    await requirePermission(orgId, "data.read.own");

    try {
      const forecasts = await prisma.spendingForecast.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
      });

      return Response.json(
        forecasts.map((forecast) => ({
          id: forecast.id,
          organizationId: forecast.organizationId,
          forecastType: forecast.forecastType,
          category: forecast.category,
          predictedAmount: centsToDollars(forecast.predictedAmount),
          confidenceScore: Number(forecast.confidenceScore),
          dataPoints: forecast.dataPoints,
          forecast: forecast.forecast,
          methodology: forecast.methodology,
          createdAt: forecast.createdAt,
          updatedAt: forecast.updatedAt,
        }))
      );
    } catch (err) {
      console.error("[forecast GET]", err);
      return Response.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
    }
  });
}

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = GenerateSpendingForecastInput.safeParse(body);
    if (!result.success) {
      return Response.json(
        { error: "Invalid request body", issues: result.error.issues },
        { status: 400 }
      );
    }

    const { organizationId, forecastType, category, daysLookback } = result.data;
    const ctx = await requirePermission(organizationId, "data.read.own");

    // Get historical transaction data
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - daysLookback);

    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId,
        date: {
          gte: lookbackDate,
        },
        ...(category ? { customCategory: category } : {}),
      },
    });

    if (transactions.length === 0) {
      return Response.json(
        { error: "Insufficient historical data for forecast" },
        { status: 400 }
      );
    }

    // Group transactions by date
    const dailyData = new Map<string, number>();
    transactions.forEach((tx) => {
      const dateStr = tx.date.toISOString().split("T")[0];
      const current = dailyData.get(dateStr) || 0;
      const amount = Number(Math.abs(tx.amount));
      dailyData.set(dateStr, current + amount);
    });

    const historicalData = Array.from(dailyData.entries()).map(([date, amount]) => ({
      date: new Date(date),
      amount,
    }));

    // Determine forecast period
    const forecastDays =
      forecastType === "monthly"
        ? 30
        : forecastType === "quarterly"
          ? 90
          : 365;

    const { forecast, confidence, predictedTotal } = calculateLinearForecast(
      historicalData,
      forecastDays
    );

    const forecastStartDate = new Date();
    const forecastEndDate = new Date();
    forecastEndDate.setDate(forecastEndDate.getDate() + forecastDays);

    const spendingForecast = await prisma.spendingForecast.upsert({
      where: {
        organization_id_user_id_forecast_type_category_forecast_start_date_key: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          forecastType,
          category: category || null,
          forecastStartDate: new Date(forecastStartDate.toISOString().split("T")[0]),
        },
      },
      create: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        forecastType,
        category: category || null,
        forecastStartDate,
        forecastEndDate,
        predictedAmount: BigInt(predictedTotal),
        confidenceScore: confidence,
        dataPoints: transactions.length,
        forecast,
        methodology: "linear_regression",
      },
      update: {
        forecastEndDate,
        predictedAmount: BigInt(predictedTotal),
        confidenceScore: confidence,
        dataPoints: transactions.length,
        forecast,
      },
    });

    return Response.json(
      {
        id: spendingForecast.id,
        organizationId: spendingForecast.organizationId,
        forecastType: spendingForecast.forecastType,
        category: spendingForecast.category,
        predictedAmount: centsToDollars(spendingForecast.predictedAmount),
        confidenceScore: Number(spendingForecast.confidenceScore),
        dataPoints: spendingForecast.dataPoints,
        forecast: spendingForecast.forecast,
        methodology: spendingForecast.methodology,
        createdAt: spendingForecast.createdAt,
        updatedAt: spendingForecast.updatedAt,
      },
      { status: 201 }
    );
  });
}
