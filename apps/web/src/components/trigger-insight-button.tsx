"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

interface TriggerInsightButtonProps {
  orgId: string;
}

export function TriggerInsightButton({ orgId }: TriggerInsightButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const trigger = async () => {
    setLoading(true);
    try {
      await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={trigger}
      disabled={loading || done}
      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
    >
      <Sparkles className="h-4 w-4" />
      {done ? "Queued!" : loading ? "Requesting…" : "Generate Insight"}
    </button>
  );
}
