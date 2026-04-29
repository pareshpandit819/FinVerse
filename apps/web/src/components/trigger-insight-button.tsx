"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";

interface TriggerInsightButtonProps {
  orgId: string;
}

export function TriggerInsightButton({ orgId }: TriggerInsightButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });

      if (!res.ok) {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }

      setStatus("done");
      router.refresh();
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const cfg = {
    idle:    { icon: <Sparkles    className="h-4 w-4" />,              label: "Generate Insight", cls: "bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/30" },
    loading: { icon: <Loader2     className="h-4 w-4 animate-spin" />, label: "Generating…",      cls: "bg-sky-500 text-white opacity-75 cursor-not-allowed" },
    done:    { icon: <CheckCircle2 className="h-4 w-4" />,             label: "Insight Added!",   cls: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30" },
    error:   { icon: <Sparkles    className="h-4 w-4" />,              label: "Try Again",        cls: "bg-rose-500 hover:bg-rose-600 text-white" },
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
