import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { toCents } from "@repo/shared/money";

export async function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId");
    if (!orgId) {
      return Response.json({ error: "Missing organizationId" }, { status: 400 });
    }

    const ctx = await requirePermission(orgId, "account.read.own");

    const creditAccounts = await prisma.creditAccount.findMany({
      where: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      },
      orderBy: { openDate: "desc" },
    });

    return Response.json(creditAccounts);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    if (
      typeof body !== "object" ||
      body === null ||
      !("organizationId" in body) ||
      !("accountName" in body) ||
      !("accountType" in body)
    ) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      organizationId,
      accountName,
      accountType,
      accountNumber,
      creditor,
      balance,
      creditLimit,
      accountStatus,
      paymentStatus,
      monthlyPayment,
      openDate,
      lastPaymentDate,
      nextPaymentDue,
    } = body as {
      organizationId: string;
      accountName: string;
      accountType: string;
      accountNumber: string;
      creditor: string;
      balance: number;
      creditLimit?: number;
      accountStatus?: string;
      paymentStatus?: string;
      monthlyPayment?: number;
      openDate: string;
      lastPaymentDate?: string;
      nextPaymentDue?: string;
    };

    const ctx = await requirePermission(organizationId, "account.write.own");

    const creditAccount = await prisma.creditAccount.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        accountName,
        accountType,
        accountNumber,
        creditor,
        balance: BigInt(Math.round(balance * 100)),
        creditLimit: creditLimit ? BigInt(Math.round(creditLimit * 100)) : null,
        accountStatus: accountStatus ?? "open",
        paymentStatus: paymentStatus ?? "current",
        monthlyPayment: monthlyPayment ? BigInt(Math.round(monthlyPayment * 100)) : null,
        openDate: new Date(openDate),
        lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
        nextPaymentDue: nextPaymentDue ? new Date(nextPaymentDue) : null,
      },
    });

    return Response.json(creditAccount, { status: 201 });
  });
}
