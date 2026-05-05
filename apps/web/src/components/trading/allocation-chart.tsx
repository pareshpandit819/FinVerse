"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface AllocationChartProps {
  data: Array<{ name: string; valueCents: number; allocationPercent: number }>;
}

const COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#6366f1", "#ec4899",
  "#14b8a6", "#f97316", "#8b5cf6", "#84cc16", "#ef4444",
];

export function AllocationChart({ data }: AllocationChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-sky-400/70">
        No holdings to display
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name.charAt(0).toUpperCase() + d.name.slice(1).replace(/_/g, " "),
    value: d.allocationPercent,
    valueCents: d.valueCents,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
          contentStyle={{ borderRadius: "0.75rem", border: "1px solid #e0f2fe", fontSize: 12 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-xs text-sky-700">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
