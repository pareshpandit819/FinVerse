"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { formatCentsNumber, formatDate } from "@/lib/format";

interface DayData {
  totalCents: number;
  txCount: number;
  topMerchants: string[];
}

interface HeatmapData {
  days: Record<string, DayData>;
  year: number;
  month: number;
}

function intensityClasses(totalCents: number, maxCents: number): { bg: string; text: string } {
  if (totalCents === 0 || maxCents === 0) return { bg: "bg-gray-50 border border-gray-100", text: "text-gray-300" };
  const r = totalCents / maxCents;
  if (r <= 0.2) return { bg: "bg-sky-100", text: "text-sky-700" };
  if (r <= 0.4) return { bg: "bg-sky-200", text: "text-sky-800" };
  if (r <= 0.6) return { bg: "bg-sky-400", text: "text-white" };
  if (r <= 0.8) return { bg: "bg-sky-600", text: "text-white" };
  return { bg: "bg-sky-800", text: "text-white" };
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HeatmapPage() {
  const now = new Date();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/org/active")
      .then((r) => r.json())
      .then((json) => setOrgId(json?.org?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    setSelectedDay(null);
    fetch(`/api/heatmap?orgId=${orgId}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId, year, month]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const todayStr = now.toISOString().split("T")[0]!;
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const maxSpend = data ? Math.max(0, ...Object.values(data.days).map((d) => d.totalCents)) : 0;
  const totalMonthSpend = data ? Object.values(data.days).reduce((s, d) => s + d.totalCents, 0) : 0;
  const activeDays = data ? Object.values(data.days).filter((d) => d.totalCents > 0).length : 0;
  const avgDailySpend = activeDays > 0 ? totalMonthSpend / activeDays : 0;

  const selectedData = selectedDay ? data?.days[selectedDay] : null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sky-950">Spending Heatmap</h1>
          <p className="mt-1 text-sm font-medium text-sky-600/70">
            Daily spending intensity — darker means more spent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 text-sky-600 transition-colors hover:bg-sky-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[130px] text-center text-sm font-semibold text-sky-950">
            {monthName} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 text-sky-600 transition-colors hover:bg-sky-50 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Spent", value: formatCentsNumber(totalMonthSpend) },
          { label: "Highest Day", value: maxSpend > 0 ? formatCentsNumber(maxSpend) : "—" },
          { label: "Avg Active Day", value: activeDays > 0 ? formatCentsNumber(Math.round(avgDailySpend)) : "—" },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-sky-600/70">{label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-sky-950">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-5">
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sky-600/50">
              <RotateCw className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="mb-2 grid grid-cols-7 gap-1">
                {DAYS_OF_WEEK.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] font-bold uppercase tracking-widest text-sky-400/70"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const dayData = data?.days[dateStr];
                  const total = dayData?.totalCents ?? 0;
                  const { bg, text } = intensityClasses(total, maxSpend);
                  const isSelected = selectedDay === dateStr;
                  const isToday = dateStr === todayStr;

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                      className={[
                        "aspect-square rounded-lg p-1 text-center transition-all duration-150",
                        bg,
                        text,
                        isSelected ? "ring-2 ring-sky-500 ring-offset-1" : "hover:ring-1 hover:ring-sky-400",
                        isToday ? "font-bold" : "",
                      ].join(" ")}
                    >
                      <span className="block text-xs leading-tight">{day}</span>
                      {total > 0 && (
                        <span className="block truncate text-[8px] leading-tight opacity-80">
                          {formatCentsNumber(total, { compact: true })}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Selected day detail */}
      {selectedDay && selectedData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-sky-950">
              {formatDate(selectedDay + "T12:00:00")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold tabular-nums text-sky-950">
              {formatCentsNumber(selectedData.totalCents)}
            </p>
            <p className="mt-0.5 text-sm text-sky-600/70">
              {selectedData.txCount} transaction{selectedData.txCount !== 1 ? "s" : ""}
            </p>
            {selectedData.topMerchants.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedData.topMerchants.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedDay && !selectedData && (
        <Card>
          <CardContent className="p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-sky-600/50">
              <CalendarDays className="h-4 w-4" />
              No expenses recorded on{" "}
              {formatDate(selectedDay + "T12:00:00")}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-sky-600/60">Less</span>
        {[
          "bg-gray-50 border border-gray-100",
          "bg-sky-100",
          "bg-sky-200",
          "bg-sky-400",
          "bg-sky-600",
          "bg-sky-800",
        ].map((cls, i) => (
          <div key={i} className={`h-4 w-4 rounded ${cls}`} />
        ))}
        <span className="text-xs text-sky-600/60">More</span>
      </div>
    </div>
  );
}
