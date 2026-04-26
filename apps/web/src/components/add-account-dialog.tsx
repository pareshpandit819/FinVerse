"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@repo/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@repo/shared/schemas";
import { Plus, Loader2 } from "lucide-react";

interface AddAccountDialogProps {
  orgId: string;
  trigger?: React.ReactNode;
}

export function AddAccountDialog({ orgId, trigger }: AddAccountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [balance, setBalance] = useState("");
  const [currency, setCurrency] = useState("USD");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !type || balance === "") { setError("Please fill in all required fields."); return; }
    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum)) { setError("Balance must be a valid number."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, name, type, balanceCurrent: balanceNum, isoCurrencyCode: currency.toUpperCase() }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Failed to add account."); return; }
      setOpen(false); setName(""); setType(""); setBalance(""); setCurrency("USD");
      router.refresh();
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sky-950">Add Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 grid gap-4">
          <div className="grid gap-1.5">
            <Label className="text-sky-700 text-xs font-semibold uppercase tracking-wide">Account Name *</Label>
            <Input placeholder="e.g. Chase Checking" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-sky-700 text-xs font-semibold uppercase tracking-wide">Account Type *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl border-sky-200 text-sky-950 focus:ring-sky-400">
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map(t => (
                  <SelectItem key={t} value={t} className="text-sky-950">{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sky-700 text-xs font-semibold uppercase tracking-wide">Balance *</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={balance} onChange={e => setBalance(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sky-700 text-xs font-semibold uppercase tracking-wide">Currency</Label>
              <Input placeholder="USD" maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : "Add Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
