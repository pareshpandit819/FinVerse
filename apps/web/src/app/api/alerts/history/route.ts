import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { z } from "zod";
import { centsToDollars } from "@repo/shared/money";

const MarkAlertViewedInput = z.object({
  alertIds: z.array(z.string().uuid()),
});

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

    const unviewedOnly = searchParams.get("unviewedOnly") === "true";

    await requirePermission(orgId, "data.read.own");

    const alertHistory = await prisma.alertHistory.findMany({
      where: {
        organizationId: orgId,
        ...(unviewedOnly ? { wasViewed: false } : {}),
      },
      include: { alertRule: true },
      orderBy: { triggeredAt: "desc" },
      take: 50,
    });

    return Response.json(
      alertHistory.map((alert) => ({
        ...alert,
        triggerValue: alert.triggerValue ? centsToDollars(alert.triggerValue) : null,
      }))
    );
  });
}

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = MarkAlertViewedInput.safeParse(body);
    if (!result.success) {
      return Response.json(
        { error: "Invalid request body", issues: result.error.issues },
        { status: 400 }
      );
    }

    const { alertIds } = result.data;
    const ctx = await requirePermission(await getOrgIdFromContext(), "data.write.own");

    // Mark all alerts as viewed
    await prisma.alertHistory.updateMany({
      where: {
        id: { in: alertIds },
        organizationId: ctx.organizationId,
      },
      data: { wasViewed: true },
    });

    return Response.json({ success: true });
  });
}

// Helper to get org from context (would be from session in real implementation)
async function getOrgIdFromContext(): Promise<string> {
  // In a real app, this would come from the session context
  // For now, we'll return a placeholder
  return "org-id";
}
