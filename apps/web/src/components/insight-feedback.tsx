"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface InsightFeedbackProps {
  insightId: string;
  helpful: boolean | null;
}

export function InsightFeedback({ insightId, helpful: initialHelpful }: InsightFeedbackProps) {
  const [helpful, setHelpful] = useState<boolean | null>(initialHelpful);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (value: boolean) => {
    if (submitting || helpful === value) return;
    setSubmitting(true);
    try {
      await fetch(`/api/insights/${insightId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful: value }),
      });
      setHelpful(value);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs text-muted-foreground">Was this helpful?</span>
      <button
        onClick={() => submit(true)}
        disabled={submitting}
        aria-label="Helpful"
        className={`rounded p-1 transition-colors ${helpful === true ? "text-green-600" : "text-muted-foreground hover:text-foreground"}`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => submit(false)}
        disabled={submitting}
        aria-label="Not helpful"
        className={`rounded p-1 transition-colors ${helpful === false ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
