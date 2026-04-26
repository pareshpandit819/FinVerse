import { NextResponse } from "next/server";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { prisma } from "@repo/db/client";
import { InsightFeedbackSchema } from "@repo/shared/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthErrors(async () => {
    const { id } = await params;
    const body = await request.json() as unknown;
    const parsed = InsightFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid feedback payload" }, { status: 400 });
    }

    const insight = await prisma.insight.findUnique({
      where: { id },
      select: { organizationId: true, userId: true },
    });

    if (!insight) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { userId } = await requirePermission(insight.organizationId, "insight.read.own");

    if (insight.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.insight.update({
      where: { id },
      data: { helpful: parsed.data.helpful },
    });

    return NextResponse.json({ ok: true });
  });
}
