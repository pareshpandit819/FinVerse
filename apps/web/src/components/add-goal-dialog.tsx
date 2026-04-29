"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@repo/ui/dialog";
import { Plus, Loader2, Target } from "lucide-react";

interface AddGoalDialogProps {
  orgId: string;
}

export function AddGoalDialog({ orgId }: AddGoalDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");

  function reset() {
    setName(""); setTargetAmount(""); setTargetDate(""); setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = parseFloat(targetAmount);
    if (!name.trim()) { setError("Goal name is required."); return; }
    if (isNaN(amount) || amount <= 0) { setError("Target amount must be a positive number."); return; }
    if (!targetDate) { setError("Target date is required."); return; }
    if (new Date(targetDate) <= new Date()) { setError("Target date must be in the future."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          name: name.trim(),
          targetAmount: amount,
          targetDate,
          linkedAccountIds: [],
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Failed to create goal.");
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // min date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button>
          <Target className="mr-2 h-4 w-4" />
          Add Goal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sky-950">New Financial Goal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-sky-700 text-xs font-semibold uppercase tracking-wide">Goal Name *</Label>
            <Input
              placeholder="e.g. Emergency Fund, New Car, Vacation"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-sky-700 text-xs font-semibold uppercase tracking-wide">Target Amount ($) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-sky-500">$</span>
              <Input
                type="number"
                step="0.01"
                min="1"
                placeholder="10,000.00"
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                className="pl-7"
                required
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-sky-700 text-xs font-semibold uppercase tracking-wide">Target Date *</Label>
            <Input
              type="date"
              min={minDate}
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
                : <><Plus className="mr-2 h-4 w-4" />Create Goal</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
