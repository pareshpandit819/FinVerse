import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { z } from "zod";
import { fromCents } from "@repo/shared/money";

const GeneratePayoffStrategyInput = z.object({
  organizationId: z.string().uuid(),
  debtAccountId: z.string().uuid(),
  monthlyPaymentAmount: z.number().positive(),
});

// Helper function to calculate payoff schedule
function calculatePayoffSchedule(
  balance: bigint,
  rate: number,
  monthlyPayment: number
): {
  schedule: Array<{
    month: number;
    balance: number;
    interest: number;
    principal: number;
    payment: number;
  }>;
  projectedMonths: number;
  totalInterest: bigint;
} {
  const monthlyRate = rate / 100 / 12;
  const paymentCents = Math.round(monthlyPayment * 100);
  let remainingBalance = Number(balance);
  let totalInterest = 0n;
  let month = 0;
  const schedule: Array<{
    month: number;
    balance: number;
    interest: number;
    principal: number;
    payment: number;
  }> = [];

  while (remainingBalance > 0 && month < 600) {
    const interestPayment = Math.round(remainingBalance * monthlyRate);
    const principalPayment = Math.min(remainingBalance - interestPayment, paymentCents - interestPayment);

    if (principalPayment <= 0 && interestPayment > 0) {
      break; // Payment too low to make progress
    }

    const actualPayment = interestPayment + principalPayment;
    remainingBalance -= principalPayment;
    totalInterest += BigInt(interestPayment);
    month++;

    schedule.push({
      month,
      balance: Math.max(0, remainingBalance),
      interest: interestPayment,
      principal: principalPayment,
      payment: actualPayment,
    });
  }

  return {
    schedule,
    projectedMonths: month,
    totalInterest,
  };
}

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = GeneratePayoffStrategyInput.safeParse(body);
    if (!result.success) {
      return Response.json(
        { error: "Invalid request body", issues: result.error.issues },
        { status: 400 }
      );
    }

    const { organizationId, debtAccountId, monthlyPaymentAmount } = result.data;
    const ctx = await requirePermission(organizationId, "data.write.own");

    // Get debt account
    const debtAccount = await prisma.debtAccount.findUnique({
      where: { id: debtAccountId },
    });

    if (!debtAccount || debtAccount.organizationId !== organizationId) {
      return Response.json({ error: "Debt account not found" }, { status: 404 });
    }

    // Calculate payoff schedule
    const { schedule, projectedMonths, totalInterest } = calculatePayoffSchedule(
      debtAccount.currentBalance,
      debtAccount.interestRate,
      monthlyPaymentAmount
    );

    if (projectedMonths === 0 || projectedMonths >= 600) {
      return Response.json(
        { error: "Payment amount too low to pay off debt or exceeds 50 years" },
        { status: 400 }
      );
    }

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + projectedMonths);

    const strategy = await prisma.payoffStrategy.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        debtAccountId,
        strategyType: "avalanche", // We'll compute both but return avalanche
        monthlyPaymentAmount: BigInt(Math.round(monthlyPaymentAmount * 100)),
        projectedPayoffMonths: projectedMonths,
        totalInterestPaid: totalInterest,
        payoffDate,
        schedule,
      },
    });

    return Response.json(
      {
        ...strategy,
        monthlyPaymentAmount: fromCents(strategy.monthlyPaymentAmount),
        totalInterestPaid: fromCents(strategy.totalInterestPaid),
      },
      { status: 201 }
    );
  });
}
