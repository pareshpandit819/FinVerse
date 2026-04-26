"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function MfaChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);

    const res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      setErrorMsg(data.error);
      setStatus("error");
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Two-factor verification</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="totp-input" className="text-sm font-medium">
              Authentication code
            </label>
            <input
              id="totp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-md border px-3 py-2 text-sm tracking-widest"
              aria-describedby={errorMsg ? "totp-error" : undefined}
            />
            {errorMsg && (
              <p id="totp-error" role="alert" className="text-sm text-destructive">
                {errorMsg}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={token.length !== 6 || status === "loading"}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {status === "loading" ? "Verifying…" : "Verify"}
          </button>
        </form>
      </div>
    </main>
  );
}
