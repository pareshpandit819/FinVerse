import { type NextRequest } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { z } from "zod";

const QuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export function GET(request: NextRequest): Promise<Response> {
  return withAuthErrors(async () => {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const query = QuerySchema.safeParse(params);
    if (!query.success) {
      return Response.json({ error: "organizationId is required" }, { status: 400 });
    }

    const ctx = await requirePermission(query.data.organizationId, "plaid.link");

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: ctx.userId },
      client_name: "Financial Dashboard",
      products: [Products.Transactions],
      optional_products: [Products.Investments, Products.Liabilities],
      country_codes: [CountryCode.Us],
      language: "en",
      webhook: process.env["PLAID_WEBHOOK_URL"],
    });

    return Response.json({ link_token: response.data.link_token });
  });
}
