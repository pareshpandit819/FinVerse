import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { z } from "zod";
import { toCents, centsToDollars } from "@repo/shared/money";

const CreateAlertRuleInput = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  ruleType: z.enum(["budget_breach", "spending_threshold", "large_transaction", "bill_due"]),
  conditionType: z.enum(["greater_than", "less_than", "equals", "percentage_increase"]),
  threshold: z.number().nonnegative(),
  notificationMethod: z.enum(["email", "in_app", "both"]).default("email"),
  metadata: z.record(z.any()).optional(),
});

const UpdateAlertRuleInput = z.object({
  name: z.string().min(1).max(100).optional(),
  conditionType: z.enum(["greater_than", "less_than", "equals", "percentage_increase"]).optional(),
  threshold: z.number().nonnegative().optional(),
  isEnabled: z.boolean().optional(),
  notificationMethod: z.enum(["email", "in_app", "both"]).optional(),
  metadata: z.record(z.any()).optional(),
});

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    await requirePermission(orgId, "data.read.own");

    const alertRules = await prisma.alertRule.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(
      alertRules.map((rule) => ({
        ...rule,
        threshold: centsToDollars(rule.threshold),
      }))
    );
  });
}

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = CreateAlertRuleInput.safeParse(body);
    if (!result.success) {
      return Response.json(
        { error: "Invalid request body", issues: result.error.issues },
        { status: 400 }
      );
    }

    const {
      organizationId,
      name,
      ruleType,
      conditionType,
      threshold,
      notificationMethod,
      metadata,
    } = result.data;
    const ctx = await requirePermission(organizationId, "data.write.own");

    const alertRule = await prisma.alertRule.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        name,
        ruleType,
        conditionType,
        threshold: toCents(threshold),
        notificationMethod,
        metadata: metadata || null,
      },
    });

    return Response.json(
      {
        ...alertRule,
        threshold: centsToDollars(alertRule.threshold),
      },
      { status: 201 }
    );
  });
}
