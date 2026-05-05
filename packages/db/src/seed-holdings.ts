/**
 * Adds demo investment holdings to the seeded Roth IRA account.
 * Run once after seed.ts.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find the Roth IRA account
  const ira = await prisma.financialAccount.findFirst({
    where: { name: "Fidelity Roth IRA", type: "investment" },
  });

  if (!ira) {
    console.error("Could not find Fidelity Roth IRA account — run seed.ts first.");
    process.exit(1);
  }

  // Update subtype
  await prisma.financialAccount.update({
    where: { id: ira.id },
    data: { subtype: "roth_ira" },
  });

  const holdings = [
    { securityId: "demo-vti", name: "Vanguard Total Stock Market ETF", ticker: "VTI",  type: "etf",   qty: "45.000",  value: 1_990_350n, cost: 1_620_000n },
    { securityId: "demo-aapl", name: "Apple Inc.",                     ticker: "AAPL", type: "equity", qty: "18.500",  value:  834_405n,  cost:  694_500n },
    { securityId: "demo-msft", name: "Microsoft Corporation",          ticker: "MSFT", type: "equity", qty: "7.000",   value:  673_420n,  cost:  532_000n },
    { securityId: "demo-vxus", name: "Vanguard Total Intl Stock ETF",  ticker: "VXUS", type: "etf",   qty: "60.000",  value:  367_200n,  cost:  390_000n },
    { securityId: "demo-bnd",  name: "Vanguard Total Bond Market ETF", ticker: "BND",  type: "etf",   qty: "48.000",  value:  368_640n,  cost:  360_000n },
    { securityId: "demo-nvda", name: "NVIDIA Corporation",             ticker: "NVDA", type: "equity", qty: "2.500",   value:  305_975n,  cost:  125_000n },
    { securityId: "demo-googl",name: "Alphabet Inc. Class A",          ticker: "GOOGL",type: "equity", qty: "3.000",   value:  545_010n,  cost:  399_000n },
  ];

  for (const h of holdings) {
    // Upsert security
    await prisma.security.upsert({
      where: { securityId: h.securityId },
      create: {
        securityId: h.securityId,
        name: h.name,
        tickerSymbol: h.ticker,
        type: h.type,
        isoCurrencyCode: "USD",
        closePrice: h.value / BigInt(Math.round(parseFloat(h.qty) * 10)) * 10n,
      },
      update: {},
    });

    const security = await prisma.security.findUnique({ where: { securityId: h.securityId } });
    if (!security) continue;

    const unrealizedGL = h.value - h.cost;

    await prisma.holding.upsert({
      where: { financialAccountId_securityId: { financialAccountId: ira.id, securityId: security.id } },
      create: {
        financialAccountId: ira.id,
        securityId: security.id,
        organizationId: ira.organizationId,
        quantity: h.qty,
        institutionValue: h.value,
        costBasis: h.cost,
        unrealizedGainLoss: unrealizedGL,
        isoCurrencyCode: "USD",
      },
      update: {
        institutionValue: h.value,
        costBasis: h.cost,
        unrealizedGainLoss: unrealizedGL,
      },
    });

    console.log(`  ✓ ${h.ticker} — $${Number(h.value) / 100} (P&L: ${unrealizedGL >= 0n ? "+" : ""}$${Number(unrealizedGL) / 100})`);
  }

  // Update IRA balance to reflect total holdings value
  const totalValue = holdings.reduce((s, h) => s + h.value, 0n);
  await prisma.financialAccount.update({
    where: { id: ira.id },
    data: { balanceCurrent: totalValue },
  });

  console.log(`\n✓ Portfolio seeded: $${Number(totalValue) / 100} across ${holdings.length} positions`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
