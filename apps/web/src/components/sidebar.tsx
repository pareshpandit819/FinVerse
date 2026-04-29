"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Target,
  PieChart,
  Lightbulb,
  Settings,
  Wallet,
  Zap,
  LogOut,
} from "lucide-react";
import { cn } from "@repo/ui/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview",  icon: LayoutDashboard },
  { href: "/accounts",  label: "Accounts",  icon: CreditCard },
  { href: "/credit",    label: "Credit",    icon: Zap },
  { href: "/net-worth", label: "Net Worth", icon: TrendingUp },
  { href: "/goals",     label: "Goals",     icon: Target },
  { href: "/budgets",   label: "Budgets",   icon: PieChart },
  { href: "/insights",  label: "Insights",  icon: Lightbulb },
] as const;

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

interface SidebarProps {
  orgName: string;
  userEmail?: string;
}

export function Sidebar({ orgName, userEmail }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-sky-950">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sky-900/60 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500 shadow-lg shadow-sky-500/40">
          <Wallet className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white tracking-tight">FinVerse</p>
          <p className="truncate text-[10px] font-medium text-sky-400/80">{orgName}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="mb-2.5 px-2 text-[10px] font-bold uppercase tracking-widest text-sky-600">
          Navigation
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                  : "text-sky-300/80 hover:bg-sky-900 hover:text-sky-100"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-white" : "text-sky-500"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="space-y-0.5 border-t border-sky-900/60 px-3 py-3">
        {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                  : "text-sky-300/80 hover:bg-sky-900 hover:text-sky-100"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-sky-500")} />
              {label}
            </Link>
          );
        })}

        {/* User pill */}
        {userEmail && (
          <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-sky-900/50 px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[11px] font-bold text-white">
              {userEmail[0]?.toUpperCase()}
            </div>
            <p className="truncate text-xs font-medium text-sky-300/80">{userEmail}</p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sky-400/70 transition-all duration-150 hover:bg-rose-900/40 hover:text-rose-300"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
