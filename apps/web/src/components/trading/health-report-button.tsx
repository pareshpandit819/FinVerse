"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Loader2, CheckCircle2 } from "lucide-react";

interface HealthReportButtonProps {
  orgId: string;
}

export function HealthReportButton({ orgId }: HealthReportButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch("/api/insights/health-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      if (!res.ok) { setStatus("error"); setTimeout(() => setStatus("idle"), 3000); return; }
      setStatus("done");
      router.push("/insights");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const cfg = {
    idle:    { icon: <HeartPulse className="h-4 w-4" />,              label: "Generate Health Report",  cls: "bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-600/30" },
    loading: { icon: <Loader2    className="h-4 w-4 animate-spin" />, label: "Analyzing finances…",     cls: "bg-violet-500 text-white opacity-75 cursor-not-allowed" },
    done:    { icon: <CheckCircle2 className="h-4 w-4" />,            label: "Report ready!",           cls: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30" },
    error:   { icon: <HeartPulse className="h-4 w-4" />,              label: "Try again",               cls: "bg-rose-500 hover:bg-rose-600 text-white" },
  }[status];

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading" || status === "done"}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </button>
  );
}
