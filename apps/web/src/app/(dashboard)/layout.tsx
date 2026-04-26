import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) redirect("/login?error=no-org");

  return (
    <div className="flex h-screen overflow-hidden bg-sky-50/60">
      <Sidebar orgName={org.name} userEmail={session.user.email ?? undefined} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-sky-100 bg-white/90 px-6 shadow-sm shadow-sky-100/30 backdrop-blur-sm">
          <div />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-sky-950">{session.user.name ?? session.user.email}</p>
              <p className="text-xs font-medium text-sky-500">{org.role}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-sm font-bold text-white shadow-sm shadow-emerald-400/30">
              {(session.user.name ?? session.user.email ?? "U")[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
