import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Separator } from "@repo/ui/separator";
import Link from "next/link";
import { Shield, Users, Building2, CreditCard, CheckCircle2, Lock } from "lucide-react";

const ROLE_BADGE: Record<string, string> = {
  OWNER:  "bg-sky-100 text-sky-700 border-sky-200",
  ADMIN:  "bg-violet-100 text-violet-700 border-violet-200",
  MEMBER: "bg-emerald-100 text-emerald-700 border-emerald-200",
  VIEWER: "bg-slate-100 text-slate-600 border-slate-200",
};

export default async function SettingsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const [mfaSecret, members] = await Promise.all([
    prisma.mfaSecret.findFirst({
      where: { userId: session.user.id, verified: true },
      select: { createdAt: true },
    }),
    prisma.membership.findMany({
      where: { organizationId: org.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const isOwnerOrAdmin = org.role === "OWNER" || org.role === "ADMIN";

  const sectionIcon = "flex h-10 w-10 items-center justify-center rounded-2xl";

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sky-950">Settings</h1>
        <p className="mt-1 text-sm font-medium text-sky-600/70">Manage your account and organization</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">

        {/* Security */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className={`${sectionIcon} bg-sky-100`}><Shield className="h-5 w-5 text-sky-600" /></div>
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Two-factor authentication</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-xl bg-sky-50 border border-sky-100 p-4">
              <div className="flex items-center gap-3">
                {mfaSecret
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  : <Lock className="h-5 w-5 text-sky-400" />}
                <div>
                  <p className="text-sm font-semibold text-sky-950">Two-Factor Authentication</p>
                  <p className="text-xs font-medium text-sky-600/70">
                    {mfaSecret
                      ? `Enabled since ${formatDate(mfaSecret.createdAt)}`
                      : "Not enabled — secure your account"}
                  </p>
                </div>
              </div>
              {mfaSecret
                ? <Badge variant="success"><CheckCircle2 className="h-3 w-3" />Enabled</Badge>
                : <Link
                    href="/mfa/enroll"
                    className="rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-600/30 transition-colors hover:bg-sky-700"
                  >
                    Enable MFA
                  </Link>}
            </div>
          </CardContent>
        </Card>

        {/* Organization */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className={`${sectionIcon} bg-violet-100`}><Building2 className="h-5 w-5 text-violet-600" /></div>
              <div>
                <CardTitle>Organization</CardTitle>
                <CardDescription>{org.name}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-sky-50 rounded-xl border border-sky-100 overflow-hidden">
              <div className="flex items-center justify-between bg-sky-50/50 px-4 py-3">
                <p className="text-sm font-medium text-sky-700">Your role</p>
                <Badge className={`border text-xs ${ROLE_BADGE[org.role] ?? ""}`}>{org.role}</Badge>
              </div>
              <div className="flex items-center justify-between bg-white px-4 py-3">
                <p className="text-sm font-medium text-sky-700">Organization ID</p>
                <code className="rounded-lg bg-sky-50 border border-sky-100 px-2 py-0.5 text-xs font-mono text-sky-700">
                  {org.id.slice(0, 8)}…
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts link */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className={`${sectionIcon} bg-emerald-100`}><CreditCard className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <CardTitle>Financial Accounts</CardTitle>
                <CardDescription>Manage manually entered accounts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-sky-700">
              Add and manage your bank accounts, credit cards, and investments on the{" "}
              <Link href="/accounts" className="font-semibold text-sky-600 underline underline-offset-2 hover:text-sky-700">
                Accounts
              </Link>{" "}
              page.
            </p>
          </CardContent>
        </Card>

        {/* Team members */}
        {isOwnerOrAdmin && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className={`${sectionIcon} bg-sky-100`}><Users className="h-5 w-5 text-sky-600" /></div>
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-sky-50 rounded-xl border border-sky-100 overflow-hidden">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between bg-white px-4 py-3 transition-colors duration-150 hover:bg-sky-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                        {(m.user.name ?? m.user.email ?? "?")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-sky-950">{m.user.name ?? m.user.email}</p>
                        {m.user.name && <p className="text-xs font-medium text-sky-500/70">{m.user.email}</p>}
                      </div>
                    </div>
                    <Badge className={`border text-xs ${ROLE_BADGE[m.role] ?? ""}`}>{m.role}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
