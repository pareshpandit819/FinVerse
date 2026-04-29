import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { z } from "zod";
import { toCents } from "@repo/shared/money";

const CreateGoalInput = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  targetAmount: z.number().positive(),
  targetDate: z.coerce.date().refine((d) => d > new Date(), {
    message: "Target date must be in the future",
  }),
  linkedAccountIds: z.array(z.string().uuid()).max(10).default([]),
});

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    await requirePermission(orgId, "data.read.own");

    const goals = await prisma.goal.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isCompleted: "asc" }, { targetDate: "asc" }],
    });

    return Response.json(goals.map(g => ({
      ...g,
      targetAmount: g.targetAmount.toString(),
      currentAmount: g.currentAmount.toString(),
      contributionRate: g.contributionRate.toString(),
    })));
  });
}

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = CreateGoalInput.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid request body", issues: result.error.issues }, { status: 400 });
    }

    const { organizationId, name, targetAmount, targetDate, linkedAccountIds } = result.data;
    const ctx = await requirePermission(organizationId, "data.write.own");

    const goal = await prisma.goal.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        name,
        targetAmount: toCents(targetAmount),
        currentAmount: 0n,
        targetDate,
        linkedAccountIds,
      },
    });

    return Response.json({
      ...goal,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      contributionRate: goal.contributionRate.toString(),
    }, { status: 201 });
  });
}
