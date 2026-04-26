import { type NextRequest } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { prisma } from "@repo/db/client";
import { decryptToken } from "@repo/shared/crypto";
import { z } from "zod";

const BodySchema = z.object({
  plaidItemId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

/**
 * POST /api/plaid/relink
 * Generates a Link token for an existing item that needs re-authentication
 * (triggered by ITEM_LOGIN_REQUIRED webhook).
 */
export function POST(request: NextRequest): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = BodySchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const ctx = await requirePermission(result.data.organizationId, "plaid.link");

    const item = await prisma.plaidItem.findFirst({
      where: {
        id: result.data.plaidItemId,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      },
    });

    if (!item) {
      return Response.json({ error: "Plaid item not found" }, { status: 404 });
    }

    const accessToken = decryptToken(item.encryptedAccessToken);

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: ctx.userId },
      client_name: "Financial Dashboard",
      products: [Products.Transactions],
      optional_products: [Products.Investments, Products.Liabilities],
      country_codes: [CountryCode.Us],
      language: "en",
      access_token: accessToken,
      webhook: process.env["PLAID_WEBHOOK_URL"],
    });

    return Response.json({ link_token: response.data.link_token });
  });
}
