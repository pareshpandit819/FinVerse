import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { z } from "zod";
import { toCents, centsToDollars } from "@repo/shared/money";

const CreateDebtAccountInput = z.object({
  organizationId: z.string().uuid(),
  accountName: z.string().min(1).max(100),
  accountType: z.enum(["credit_card", "personal_loan", "auto_loan", "mortgage", "student_loan"]),
  currentBalance: z.number().nonnegative(),
  minimumPayment: z.number().positive(),
  interestRate: z.number().min(0).max(100),
});

const UpdateDebtAccountInput = z.object({
  accountName: z.string().min(1).max(100).optional(),
  currentBalance: z.number().nonnegative().optional(),
  minimumPayment: z.number().positive().optional(),
  interestRate: z.number().min(0).max(100).optional(),
});

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    await requirePermission(orgId, "data.read.own");

    const debtAccounts = await prisma.debtAccount.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(
      debtAccounts.map((acc) => ({
        ...acc,
        currentBalance: centsToDollars(acc.currentBalance),
        minimumPayment: centsToDollars(acc.minimumPayment),
        interestRate: Number(acc.interestRate),
      }))
    );
  });
}

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = CreateDebtAccountInput.safeParse(body);
    if (!result.success) {
      return Response.json(
        { error: "Invalid request body", issues: result.error.issues },
        { status: 400 }
      );
    }

    const {
      organizationId,
      accountName,
      accountType,
      currentBalance,
      minimumPayment,
      interestRate,
    } = result.data;
    const ctx = await requirePermission(organizationId, "data.write.own");

    const debtAccount = await prisma.debtAccount.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        accountName,
        accountType,
        currentBalance: toCents(currentBalance),
        minimumPayment: toCents(minimumPayment),
        interestRate,
      },
    });

    return Response.json(
      {
        ...debtAccount,
        currentBalance: centsToDollars(debtAccount.currentBalance),
        minimumPayment: centsToDollars(debtAccount.minimumPayment),
        interestRate: Number(debtAccount.interestRate),
      },
      { status: 201 }
    );
  });
}
