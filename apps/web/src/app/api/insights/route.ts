import { NextResponse } from "next/server";
import { insightsQueue } from "@/lib/queues";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { prisma } from "@repo/db/client";
import { InsightTypeSchema } from "@repo/shared/schemas";

// GET /api/insights?orgId=<uuid>&limit=20
export async function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const { userId } = await requirePermission(orgId, "insight.read.own");

    const insights = await prisma.insight.findMany({
      where: {
        organizationId: orgId,
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { generatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        severity: true,
        actionItems: true,
        helpful: true,
        generatedAt: true,
      },
    });

    return NextResponse.json({ insights });
  });
}

// POST /api/insights — enqueue on-demand insight generation
export async function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body = await request.json() as unknown;
    const { orgId, insightType } = body as { orgId?: string; insightType?: string };

    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const { userId } = await requirePermission(orgId, "insight.read.own");

    const parsedType = insightType ? InsightTypeSchema.safeParse(insightType) : null;

    const job = await insightsQueue.add(
      "on-demand",
      {
        userId,
        organizationId: orgId,
        ...(parsedType?.success ? { insightType: parsedType.data } : {}),
        requestedAt: new Date().toISOString(),
      },
      { jobId: `insight-ondemand-${userId}-${Date.now()}` }
    );

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  });
}
