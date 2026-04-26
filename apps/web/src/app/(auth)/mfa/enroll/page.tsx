"use client";

import { useState } from "react";

export default function MfaEnrollPage() {
  const [uri, setUri] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function fetchSetup() {
    setStatus("loading");
    const res = await fetch("/api/auth/mfa/enroll");
    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      setError(data.error);
      setStatus("error");
      return;
    }
    const data = (await res.json()) as { uri: string };
    setUri(data.uri);
    setStatus("idle");
  }

  async function confirmEnrollment() {
    setStatus("loading");
    setError(null);
    const res = await fetch("/api/auth/mfa/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error: string };
      setError(data.error);
      setStatus("error");
      return;
    }
    setStatus("success");
  }

  if (status === "success") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-4 rounded-lg border p-8 shadow-sm text-center">
          <h1 className="text-2xl font-semibold">MFA Enabled</h1>
          <p className="text-sm text-muted-foreground">
            Two-factor authentication is now active on your account.
          </p>
          <a href="/dashboard" className="text-sm text-primary underline">
            Continue to dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Set up two-factor auth</h1>

        {!uri && (
          <button
            onClick={() => void fetchSetup()}
            disabled={status === "loading"}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {status === "loading" ? "Loading…" : "Generate QR code"}
          </button>
        )}

        {uri && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.),
              then enter the 6-digit code below.
            </p>
            {/* QR rendered client-side via otpauth URI */}
            <p className="break-all rounded bg-muted p-2 text-xs font-mono">{uri}</p>
            <div className="space-y-2">
              <label htmlFor="totp-token" className="text-sm font-medium">
                Verification code
              </label>
              <input
                id="totp-token"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              onClick={() => void confirmEnrollment()}
              disabled={token.length !== 6 || status === "loading"}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {status === "loading" ? "Verifying…" : "Enable MFA"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
