"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@repo/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { TRANSACTION_CATEGORIES } from "@repo/shared/schemas";
import { Plus, Loader2 } from "lucide-react";

interface Account { id: string; name: string; type: string; }
interface AddTransactionDialogProps { orgId: string; accounts: Account[]; }

export function AddTransactionDialog({ orgId, accounts }: AddTransactionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0] ?? "");
  const [category, setCategory] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId || !name || amount === "" || !date) { setError("Please fill in all required fields."); return; }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum === 0) { setError("Amount must be a non-zero number."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          financialAccountId: accountId, organizationId: orgId, amount: amountNum,
          name, merchantName: merchant || undefined, date: new Date(date).toISOString(),
          customCategory: category || undefined, pending,
        }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Failed."); return; }
      setOpen(false); setAccountId(""); setName(""); setMerchant(""); setAmount("");
      setDate(new Date().toISOString().split("T")[0] ?? ""); setCategory(""); setPending(false);
      router.refresh();
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  const fieldLabel = "text-sky-700 text-xs font-semibold uppercase tracking-wide";
  const selectCls  = "rounded-xl border-sky-200 text-sky-950 focus:ring-sky-400";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sky-950">Add Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 grid gap-4">

          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Account *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className={selectCls}><SelectValue placeholder="Select account…" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={a.id} className="text-sky-950">{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Description *</Label>
            <Input placeholder="e.g. Grocery store" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Merchant</Label>
            <Input placeholder="e.g. Whole Foods" value={merchant} onChange={e => setMerchant(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Amount * <span className="normal-case font-normal text-sky-400">(− for expense)</span></Label>
              <Input type="number" step="0.01" placeholder="-45.00" value={amount} onChange={e => setAmount(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label className={fieldLabel}>Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className={fieldLabel}>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className={selectCls}><SelectValue placeholder="Select category…" /></SelectTrigger>
              <SelectContent>
                {TRANSACTION_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-sky-950">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-2.5 transition-colors hover:bg-sky-100">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-400"
              checked={pending}
              onChange={e => setPending(e.target.checked)}
            />
            <span className="text-sm font-medium text-sky-700">Mark as pending</span>
          </label>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding…</> : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
