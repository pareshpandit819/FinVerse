"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Wallet, ArrowRight, Loader2, TrendingUp, ShieldCheck, Sparkles } from "lucide-react";

const FEATURES = [
  { icon: TrendingUp,  text: "Track net worth in real time" },
  { icon: ShieldCheck, text: "Secure & private by design" },
  { icon: Sparkles,    text: "AI-powered financial insights" },
];

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const registered  = searchParams.get("registered") === "1";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Clear any stale session before attempting a fresh login
    await signOut({ redirect: false }).catch(() => {});
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) { setError("Invalid email or password. Please try again."); setLoading(false); return; }
    window.location.href = "/dashboard";
  }

  const inputCls =
    "w-full rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm text-sky-950 placeholder-sky-300 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20";

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
              Your finances,<br />crystal clear.
            </h2>
            <p className="mt-3 text-sky-400 font-medium">
              One dashboard for every account, goal, and insight.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-900">
                  <Icon className="h-3.5 w-3.5 text-sky-400" />
                </div>
                <span className="text-sm font-medium text-sky-300">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs font-medium text-sky-700">
          © {new Date().getFullYear()} FinVerse · Built for clarity
        </p>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-sky-50/60 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-sky-950">FinVerse</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-sky-950">Welcome back</h1>
            <p className="mt-1 text-sm font-medium text-sky-600/70">Sign in to your account to continue</p>
          </div>

          {registered && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Account created! Sign in below.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-sky-700">Email address</label>
              <input id="email" type="email" required autoComplete="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-sky-700">Password</label>
              <input id="password" type="password" required autoComplete="current-password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
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
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-medium text-sky-600/70">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-bold text-sky-600 hover:text-sky-700 hover:underline underline-offset-2">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
