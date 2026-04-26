import { Worker, type Job } from "bullmq";
import { prisma } from "@repo/db/client";
import { decryptToken } from "@repo/shared/crypto";
import { plaidAmountToCents } from "@repo/shared/money";
import { logger } from "@repo/shared/logger";
import { plaidClient } from "../lib/plaid.js";
import { redis } from "../lib/redis.js";
import { z } from "zod";

const InvestmentsJobSchema = z.object({
  plaidItemId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export function createInvestmentsWorker(): Worker {
  return new Worker(
    "plaid.investments",
    async (job: Job) => {
      const result = InvestmentsJobSchema.safeParse(job.data);
      if (!result.success) throw new Error("Invalid investments job payload");

      const { plaidItemId, organizationId } = result.data;
      const log = logger.child({ jobId: job.id, plaidItemId });

      const item = await prisma.plaidItem.findUnique({ where: { id: plaidItemId } });
      if (!item) throw new Error(`PlaidItem ${plaidItemId} not found`);

      const accessToken = decryptToken(item.encryptedAccessToken);

      // Sync securities and holdings
      const holdingsResponse = await plaidClient.investmentsHoldingsGet({
        access_token: accessToken,
      });

      const { holdings, securities, accounts } = holdingsResponse.data;

      // Upsert securities (global, not org-scoped)
      for (const sec of securities) {
        await prisma.security.upsert({
          where: { plaidSecurityId: sec.security_id },
          update: {
            name: sec.name ?? "Unknown",
            tickerSymbol: sec.ticker_symbol ?? null,
            closePrice: sec.close_price != null ? plaidAmountToCents(sec.close_price) : null,
            closePriceAsOf: sec.close_price_as_of ? new Date(sec.close_price_as_of) : null,
            updatedAt: new Date(),
          },
          create: {
            plaidSecurityId: sec.security_id,
            name: sec.name ?? "Unknown",
            tickerSymbol: sec.ticker_symbol ?? null,
            type: sec.type ?? "other",
            isoCurrencyCode: sec.iso_currency_code ?? "USD",
            closePrice: sec.close_price != null ? plaidAmountToCents(sec.close_price) : null,
            closePriceAsOf: sec.close_price_as_of ? new Date(sec.close_price_as_of) : null,
          },
        });
      }

      // Upsert investment accounts
      for (const account of accounts) {
        await prisma.plaidAccount.upsert({
          where: { accountId: account.account_id },
          update: {
            balanceCurrent: plaidAmountToCents(account.balances.current ?? 0),
            updatedAt: new Date(),
          },
          create: {
            plaidItemId,
            organizationId,
            accountId: account.account_id,
            name: account.name,
            officialName: account.official_name ?? null,
            type: account.type,
            subtype: account.subtype ?? null,
            mask: account.mask ?? null,
            balanceCurrent: plaidAmountToCents(account.balances.current ?? 0),
            isoCurrencyCode: account.balances.iso_currency_code ?? "USD",
          },
        });
      }

      // Upsert holdings
      for (const holding of holdings) {
        const account = await prisma.plaidAccount.findUnique({
          where: { accountId: holding.account_id },
          select: { id: true },
        });
        const security = await prisma.security.findUnique({
          where: { plaidSecurityId: holding.security_id },
          select: { id: true },
        });
        if (!account || !security) continue;

        await prisma.holding.upsert({
          where: { plaidAccountId_securityId: { plaidAccountId: account.id, securityId: security.id } },
          update: {
            quantity: holding.quantity,
            institutionValue: plaidAmountToCents(holding.institution_value),
            costBasis: holding.cost_basis != null ? plaidAmountToCents(holding.cost_basis) : null,
            updatedAt: new Date(),
          },
          create: {
            plaidAccountId: account.id,
            securityId: security.id,
            organizationId,
            quantity: holding.quantity,
            institutionValue: plaidAmountToCents(holding.institution_value),
            costBasis: holding.cost_basis != null ? plaidAmountToCents(holding.cost_basis) : null,
            isoCurrencyCode: holding.iso_currency_code ?? "USD",
          },
        });
      }

      log.info({ holdings: holdings.length, securities: securities.length }, "Investments sync complete");
    },
    { connection: redis, concurrency: 3 }
  );
}
