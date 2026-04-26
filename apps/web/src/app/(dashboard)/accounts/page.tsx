import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { CreditCard, Landmark, TrendingUp, Wallet, PiggyBank } from "lucide-react";
import { ACCOUNT_TYPE_LABELS } from "@repo/shared/schemas";
import type { AccountType } from "@repo/shared/schemas";

const TYPE_ICONS: Record<string, React.ElementType> = {
  checking: Landmark,
  savings: PiggyBank,
  credit_card: CreditCard,
  investment: TrendingUp,
  loan: Wallet,
  other: Wallet,
};

const LIABILITY_TYPES = new Set(["credit_card", "loan"]);

export default async function AccountsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId: org.id },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  const canWrite = ["OWNER", "ADMIN", "MEMBER"].includes(org.role);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</p>
        </div>
        {canWrite && <AddAccountDialog orgId={org.id} />}
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="font-semibold">No accounts yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add your bank accounts, credit cards, or loans to start tracking your finances.
            </p>
            {canWrite && <AddAccountDialog orgId={org.id} />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const Icon = TYPE_ICONS[account.type] ?? Wallet;
            const isLiability = LIABILITY_TYPES.has(account.type);
            const label = ACCOUNT_TYPE_LABELS[account.type as AccountType] ?? "Account";
            return (
              <Card key={account.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{account.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className="w-fit text-xs">{label}</Badge>
                </CardHeader>
                <CardContent>
                  <div className={`text-xl font-bold ${isLiability ? "text-red-500" : ""}`}>
                    {isLiability ? "−" : ""}{formatCents(account.balanceCurrent)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{account.isoCurrencyCode}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
