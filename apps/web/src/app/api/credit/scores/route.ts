import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";

export async function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("organizationId");
    if (!orgId) {
      return Response.json({ error: "Missing organizationId" }, { status: 400 });
    }

    const ctx = await requirePermission(orgId, "account.read.own");

    const creditScores = await prisma.creditScore.findMany({
      where: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      },
      orderBy: { scoreDate: "desc" },
      take: 365,
    });

    return Response.json(creditScores);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    if (
      typeof body !== "object" ||
      body === null ||
      !("organizationId" in body) ||
      !("score" in body) ||
      !("scoreDate" in body)
    ) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      organizationId,
      score,
      scoreDate,
      paymentHistory,
      creditUtilization,
      creditAge,
      derogatoryMarks,
      hardInquiries,
      totalAccounts,
    } = body as {
      organizationId: string;
      score: number;
      scoreDate: string;
      paymentHistory?: number;
      creditUtilization?: number;
      creditAge?: number;
      derogatoryMarks?: number;
      hardInquiries?: number;
      totalAccounts?: number;
    };

    const ctx = await requirePermission(organizationId, "account.write.own");

    const creditScore = await prisma.creditScore.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        score,
        scoreDate: new Date(scoreDate),
        paymentHistory: paymentHistory ?? 0,
        creditUtilization: creditUtilization ?? 0,
        creditAge: creditAge ?? 0,
        derogatoryMarks: derogatoryMarks ?? 0,
        hardInquiries: hardInquiries ?? 0,
        totalAccounts: totalAccounts ?? 0,
      },
    });

    return Response.json(creditScore, { status: 201 });
  });
}
