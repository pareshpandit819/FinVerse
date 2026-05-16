import { prisma } from "@repo/db/client";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { CreateTransactionSchema } from "@repo/shared/schemas";
import { toCents } from "@repo/shared/money";
import { budgetQueue } from "@/lib/queues";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const CSV_EXPORT_LIMIT = 1000;

function parseNumberParam(value: string | null): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;

  return undefined;
}

function parseLimitParam(value: string | null): number {
  const parsed = parseNumberParam(value);

  if (parsed === undefined) return DEFAULT_LIMIT;

  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function dollarsToCentsParam(value: string | null): bigint | undefined {
  const parsed = parseNumberParam(value);

  if (parsed === undefined) return undefined;

  return toCents(parsed);
}

function serializeBigInt<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, innerValue) =>
      typeof innerValue === "bigint" ? innerValue.toString() : innerValue
    )
  ) as T;
}

function escapeCsvValue(value: unknown): string {
  const stringValue = String(value ?? "");

  return `"${stringValue.replaceAll('"', '""')}"`;
}

export function GET(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const { searchParams } = new URL(request.url);

    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return Response.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    const ctx = await requirePermission(
      organizationId,
      "transaction.read.own"
    );

    const q = searchParams.get("q");
    const financialAccountId = searchParams.get("financialAccountId");
    const customCategory = searchParams.get("customCategory");
    const merchantName = searchParams.get("merchantName");
    const pending = parseBooleanParam(searchParams.get("pending"));
    const startDate = parseDateParam(searchParams.get("startDate"));
    const endDate = parseDateParam(searchParams.get("endDate"));
    const minAmount = dollarsToCentsParam(searchParams.get("minAmount"));
    const maxAmount = dollarsToCentsParam(searchParams.get("maxAmount"));
    const cursor = searchParams.get("cursor");
    const exportFormat = searchParams.get("export");
    const limit = parseLimitParam(searchParams.get("limit"));

    const where = {
      organizationId: ctx.organizationId,

      ...(financialAccountId ? { financialAccountId } : {}),

      ...(customCategory
        ? {
            customCategory: {
              contains: customCategory,
              mode: "insensitive" as const,
            },
          }
        : {}),

      ...(merchantName
        ? {
            merchantName: {
              contains: merchantName,
              mode: "insensitive" as const,
            },
          }
        : {}),

      ...(pending !== undefined ? { pending } : {}),

      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),

      ...(minAmount !== undefined || maxAmount !== undefined
        ? {
            amount: {
              ...(minAmount !== undefined ? { gte: minAmount } : {}),
              ...(maxAmount !== undefined ? { lte: maxAmount } : {}),
            },
          }
        : {}),

      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
              {
                merchantName: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
              {
                customCategory: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: exportFormat === "csv" ? CSV_EXPORT_LIMIT : limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });

    if (exportFormat === "csv") {
      const header = [
        "date",
        "name",
        "merchantName",
        "customCategory",
        "financialAccountId",
        "amount",
        "isoCurrencyCode",
        "pending",
      ];

      const rows = transactions.map((transaction) => ({
        date: transaction.date.toISOString().slice(0, 10),
        name: transaction.name,
        merchantName: transaction.merchantName ?? "",
        customCategory: transaction.customCategory ?? "",
        financialAccountId: transaction.financialAccountId,
        amount: Number(transaction.amount) / 100,
        isoCurrencyCode: transaction.isoCurrencyCode,
        pending: transaction.pending,
      }));

      const csv = [
        header.join(","),
        ...rows.map((row) =>
          header
            .map((key) => escapeCsvValue(row[key as keyof typeof row]))
            .join(",")
        ),
      ].join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="transactions.csv"',
        },
      });
    }

    const hasMore = transactions.length > limit;
    const items = hasMore ? transactions.slice(0, limit) : transactions;
    const nextCursor = hasMore ? items.at(-1)?.id ?? null : null;

    return Response.json(
      serializeBigInt({
        items,
        nextCursor,
      })
    );
  });
}

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = CreateTransactionSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        {
          error: "Invalid request body",
          issues: result.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      financialAccountId,
      organizationId,
      amount,
      name,
      date,
      customCategory,
      merchantName,
      pending,
      isoCurrencyCode,
    } = result.data;

    const ctx = await requirePermission(
      organizationId,
      "transaction.write.own"
    );

    const transaction = await prisma.transaction.create({
      data: {
        financialAccountId,
        organizationId: ctx.organizationId,
        amount: toCents(amount),
        isoCurrencyCode,
        date: new Date(date),
        name,
        merchantName: merchantName ?? null,
        customCategory: customCategory ?? null,
        pending,
      },
    });

    const txDate = new Date(date);

    await budgetQueue.add(
      "aggregate",
      {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        month: txDate.getUTCMonth() + 1,
        year: txDate.getUTCFullYear(),
      },
      {
        jobId: `budget-${ctx.organizationId}-${txDate.getUTCFullYear()}-${
          txDate.getUTCMonth() + 1
        }`,
      }
    );

    return Response.json(serializeBigInt(transaction), { status: 201 });
  });
}
