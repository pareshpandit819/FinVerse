import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { z } from "zod";
import { centsToDollars } from "@repo/shared/money";

const CreatePayoffPlanInput = z.object({
  organizationId: z.string().uuid(),
  debtAccountId: z.string().uuid(),
  strategyType: z.enum(["avalanche", "snowball"]),
  monthlyPaymentAmount: z.number().positive(),
});

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    await requirePermission(orgId, "data.read.own");

    const payoffPlans = await prisma.payoffPlan.findMany({
      where: { organizationId: orgId },
      include: { debtAccount: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(
      payoffPlans.map((plan) => ({
        ...plan,
        monthlyPaymentAmount: centsToDollars(plan.monthlyPaymentAmount),
        totalInterestSaved: centsToDollars(plan.totalInterestSaved),
        debtAccount: {
          ...plan.debtAccount,
          currentBalance: centsToDollars(plan.debtAccount.currentBalance),
          minimumPayment: centsToDollars(plan.debtAccount.minimumPayment),
        },
      }))
    );
  });
}

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = CreatePayoffPlanInput.safeParse(body);
    if (!result.success) {
      return Response.json(
        { error: "Invalid request body", issues: result.error.issues },
        { status: 400 }
      );
    }

    const { organizationId, debtAccountId, strategyType, monthlyPaymentAmount } = result.data;
    const ctx = await requirePermission(organizationId, "data.write.own");

    // Check if a plan already exists for this debt account
    const existingPlan = await prisma.payoffPlan.findFirst({
      where: { debtAccountId, isActive: true },
    });

    if (existingPlan) {
      // Deactivate the old plan
      await prisma.payoffPlan.update({
        where: { id: existingPlan.id },
        data: { isActive: false },
      });
    }

    // Get debt account
    const debtAccount = await prisma.debtAccount.findUnique({
      where: { id: debtAccountId },
    });

    if (!debtAccount || debtAccount.organizationId !== organizationId) {
      return Response.json({ error: "Debt account not found" }, { status: 404 });
    }

    // Calculate months to payoff (simplified)
    const monthlyRate = debtAccount.interestRate / 100 / 12;
    let balance = Number(debtAccount.currentBalance);
    let months = 0;
    const paymentAmount = monthlyPaymentAmount * 100;

    while (balance > 0 && months < 600) {
      const interest = balance * monthlyRate;
      const principal = Math.min(balance, paymentAmount - interest);
      if (principal <= 0) break;
      balance -= principal;
      months++;
    }

    const projectedPayoffDate = new Date();
    projectedPayoffDate.setMonth(projectedPayoffDate.getMonth() + months);

    const payoffPlan = await prisma.payoffPlan.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        debtAccountId,
        strategyType,
        monthlyPaymentAmount: BigInt(Math.round(monthlyPaymentAmount * 100)),
        startDate: new Date(),
        projectedPayoffDate,
        isActive: true,
      },
    });

    return Response.json(
      {
        ...payoffPlan,
        monthlyPaymentAmount: centsToDollars(payoffPlan.monthlyPaymentAmount),
        totalInterestSaved: centsToDollars(payoffPlan.totalInterestSaved),
      },
      { status: 201 }
    );
  });
}
