"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";

interface CreditScoreDataPoint {
  date: string;
  score: number;
}

interface CreditHistoryChartProps {
  data: CreditScoreDataPoint[];
}

function formatScoreAxis(value: number): string {
  return `${value}`;
}

export function CreditHistoryChart({ data }: CreditHistoryChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credit Score History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No credit score data yet — add your first credit score to see history.
          </div>
        </CardContent>
      </Card>
    );
  }

  const minScore = Math.min(...data.map((d) => d.score));
  const maxScore = Math.max(...data.map((d) => d.score));
  const avgScore = Math.round(data.reduce((sum, d) => sum + d.score, 0) / data.length);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Credit Score History</CardTitle>
            <p className="mt-1 text-xs text-sky-600/70">
              Track your credit score trends over time
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-right">
              <p className="text-xs font-semibold uppercase text-sky-600/60">Current</p>
              <p className="mt-0.5 text-lg font-bold text-sky-700">{data[data.length - 1].score}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase text-sky-600/60">Average</p>
              <p className="mt-0.5 text-lg font-bold text-sky-700">{avgScore}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase text-sky-600/60">Change</p>
              <p className={`mt-0.5 text-lg font-bold ${
                data[data.length - 1].score >= data[0].score ? "text-emerald-600" : "text-rose-600"
              }`}>
                {data[data.length - 1].score - data[0].score > 0 ? "+" : ""}
                {data[data.length - 1].score - data[0].score}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(d: string) =>
                new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => formatScoreAxis(v)}
              domain={[Math.max(300, minScore - 50), Math.min(850, maxScore + 50)]}
              width={50}
            />
            <Tooltip
              formatter={(value: number) => [value.toString(), "Score"]}
              labelFormatter={(label: string) =>
                new Date(label).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              }
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid rgb(203, 213, 225)",
                borderRadius: "0.5rem",
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
