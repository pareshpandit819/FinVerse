import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";

export async function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId");
    const creditAccountId = searchParams.get("creditAccountId");

    if (!orgId) {
      return Response.json({ error: "Missing organizationId" }, { status: 400 });
    }

    const ctx = await requirePermission(orgId, "account.read.own");

    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    };

    if (creditAccountId) {
      where.creditAccountId = creditAccountId;
    }

    const creditHistory = await prisma.creditHistory.findMany({
      where,
      orderBy: { eventDate: "desc" },
      take: 100,
    });

    return Response.json(creditHistory);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    if (
      typeof body !== "object" ||
      body === null ||
      !("organizationId" in body) ||
      !("creditAccountId" in body) ||
      !("eventType" in body) ||
      !("eventDate" in body) ||
      !("eventDescription" in body)
    ) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      organizationId,
      creditAccountId,
      eventType,
      eventDate,
      eventDescription,
      metadata,
    } = body as {
      organizationId: string;
      creditAccountId: string;
      eventType: string;
      eventDate: string;
      eventDescription: string;
      metadata?: Record<string, any>;
    };

    const ctx = await requirePermission(organizationId, "account.write.own");

    const creditHistoryEntry = await prisma.creditHistory.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        creditAccountId,
        eventType,
        eventDate: new Date(eventDate),
        eventDescription,
        metadata: metadata ?? null,
      },
    });

    return Response.json(creditHistoryEntry, { status: 201 });
  });
}
