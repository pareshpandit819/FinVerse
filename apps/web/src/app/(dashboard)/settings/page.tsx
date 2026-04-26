import { auth } from "@/lib/auth";
import { getActiveOrg, getUserMemberships } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { Separator } from "@repo/ui/separator";
import Link from "next/link";
import { Shield, Users, Building2, Key } from "lucide-react";

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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and organization preferences</p>
      </div>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>Two-factor authentication and session management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication (TOTP)</p>
              <p className="text-xs text-muted-foreground">
                {mfaSecret
                  ? `Enabled since ${formatDate(mfaSecret.createdAt)}`
                  : "Not enabled. Add an extra layer of security to your account."}
              </p>
            </div>
            {mfaSecret ? (
              <Badge variant="success">Enabled</Badge>
            ) : (
              <Link
                href="/mfa/enroll"
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
              >
                Enable MFA
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Organization</CardTitle>
          </div>
          <CardDescription>{org.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your role</span>
            <Badge variant="outline">{org.role}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Slug</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{org.id.slice(0, 8)}…</code>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Team Members</CardTitle>
            </div>
            <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((m, i) => (
                <div key={m.id}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                      {m.user.name && <p className="text-xs text-muted-foreground">{m.user.email}</p>}
                    </div>
                    <Badge variant={m.role === "OWNER" ? "default" : "outline"}>{m.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys placeholder */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Connected Services</CardTitle>
          </div>
          <CardDescription>Plaid integration and data sync status</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Manage connected bank accounts on the{" "}
            <Link href="/accounts" className="text-primary underline underline-offset-2">Accounts</Link>{" "}
            page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
