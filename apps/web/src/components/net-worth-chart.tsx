"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

interface NetWorthChartProps {
  data: DataPoint[];
}

function formatDollarAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function formatTooltipValue(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
}

export function NetWorthChart({ data }: NetWorthChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data yet — snapshots appear after the first sync.
      </div>
    );
  }

  return (
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
          tickFormatter={(v: number) => formatDollarAxis(v / 100)}
          width={70}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatTooltipValue(value),
            name === "netWorth" ? "Net Worth" : name === "assets" ? "Assets" : "Liabilities",
          ]}
          labelFormatter={(label: string) =>
            new Date(label).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
          }
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="assets"
          stroke="rgb(34 197 94)"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="liabilities"
          stroke="rgb(239 68 68)"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
