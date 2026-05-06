import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { z } from "zod";

const TagInput = z.object({
  orgId: z.string().uuid(),
  merchantNames: z.array(z.string()).min(1),
});

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = TagInput.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid input", issues: result.error.issues }, { status: 400 });
    }

    const { orgId, merchantNames } = result.data;
    await requirePermission(orgId, "transaction.write.own");

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    await prisma.transaction.updateMany({
      where: {
        organizationId: orgId,
        date: { gte: ninetyDaysAgo },
        merchantName: { in: merchantNames },
        pending: false,
      },
      data: { customCategory: "Subscription" },
    });

    return Response.json({ success: true });
  });
}
