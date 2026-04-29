"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";

interface DeleteAccountButtonProps {
  accountId: string;
  accountName: string;
}

export function DeleteAccountButton({ accountId, accountName }: DeleteAccountButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Failed to delete account.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-sky-400/50 opacity-0 transition-all duration-150 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
        title="Delete account"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sky-950">Delete Account</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <p className="text-sm text-sky-700/80">
              Are you sure you want to delete <span className="font-semibold text-sky-950">{accountName}</span>?
              All transactions linked to this account will also be removed.
            </p>
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600">
                {error}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
