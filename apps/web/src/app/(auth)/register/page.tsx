"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

const PERKS = [
  "Connect checking, savings & investment accounts",
  "Set goals and track your progress",
  "Category-based budget tracking",
  "AI-powered spending insights",
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm)   { setError("Passwords do not match."); return; }
    if (password.length < 8)    { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Registration failed."); return; }
      router.push("/login?registered=1");
    } catch { setError("Network error. Please try again."); }
    finally   { setLoading(false); }
  }

  const inputCls =
    "w-full rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm text-sky-950 placeholder-sky-300 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20";
  const labelCls = "text-xs font-bold uppercase tracking-wider text-sky-700";

  return (
    <div className="flex min-h-screen">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between bg-sky-950 p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 shadow-lg shadow-sky-500/40">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">FinVerse</span>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-snug tracking-tight text-white">
              Take control of<br />your money.
            </h2>
            <p className="mt-3 font-medium text-sky-400">
              Free forever. Start in under a minute.
            </p>
          </div>

          <ul className="space-y-3">
            {PERKS.map(perk => (
              <li key={perk} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span className="text-sm font-medium text-sky-300">{perk}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs font-medium text-sky-700">
          © {new Date().getFullYear()} FinVerse · Built for clarity
        </p>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-sky-50/60 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-sky-950">FinVerse</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-sky-950">Create your account</h1>
            <p className="mt-1 text-sm font-medium text-sky-600/70">Free forever. No credit card required.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className={labelCls}>Full name</label>
              <input id="name" type="text" required autoComplete="name" placeholder="Alice Smith"
                value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className={labelCls}>Email address</label>
              <input id="email" type="email" required autoComplete="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className={labelCls}>Password</label>
              <input id="password" type="password" required autoComplete="new-password" placeholder="At least 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm" className={labelCls}>Confirm password</label>
              <input id="confirm" type="password" required autoComplete="new-password" placeholder="••••••••"
                value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-sky-600/30 transition-all hover:bg-sky-700 hover:shadow-md hover:shadow-sky-600/25 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-medium text-sky-600/70">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-sky-600 hover:text-sky-700 hover:underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
