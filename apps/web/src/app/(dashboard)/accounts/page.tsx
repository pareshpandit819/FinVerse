import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";
import { prisma } from "@repo/db/client";
import { formatCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { CreditCard, Landmark, TrendingUp, Wallet } from "lucide-react";

const TYPE_ICONS: Record<string, React.ElementType> = {
  depository: Landmark,
  credit: CreditCard,
  investment: TrendingUp,
  loan: Wallet,
};

const TYPE_LABELS: Record<string, string> = {
  depository: "Bank Account",
  credit: "Credit Card",
  investment: "Investment",
  loan: "Loan",
  other: "Other",
};

export default async function AccountsPage() {
  const session = await auth();
  const org = await getActiveOrg();
  if (!org || !session?.user?.id) return null;

  const items = await prisma.plaidItem.findMany({
    where: { organizationId: org.id },
    include: {
      accounts: {
        orderBy: { type: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const canLink = ["OWNER", "ADMIN", "MEMBER"].includes(org.role);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">{items.reduce((s, i) => s + i.accounts.length, 0)} connected accounts</p>
        </div>
        {canLink && <PlaidLinkButton orgId={org.id} />}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="font-semibold">No accounts connected</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Connect your bank accounts to start tracking your finances.</p>
            {canLink && <PlaidLinkButton orgId={org.id} />}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <div key={item.id}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold">{item.institutionName}</h2>
                <Badge variant={item.status === "active" ? "success" : "warning"}>
                  {item.status === "active" ? "Connected" : "Needs attention"}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {item.accounts.map((account) => {
                  const Icon = TYPE_ICONS[account.type] ?? CreditCard;
                  const isLiability = account.type === "credit" || account.type === "loan";
                  return (
                    <Card key={account.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-sm">{account.name}</CardTitle>
                          </div>
                          {account.mask && (
                            <span className="text-xs text-muted-foreground">••{account.mask}</span>
                          )}
                        </div>
                        <Badge variant="outline" className="w-fit text-xs">
                          {TYPE_LABELS[account.type] ?? "Account"}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xl font-bold">
                          <span className={isLiability ? "text-red-500" : ""}>
                            {isLiability ? "-" : ""}{formatCents(account.balanceCurrent)}
                          </span>
                        </div>
                        {account.balanceAvailable !== null && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCents(account.balanceAvailable)} available
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
