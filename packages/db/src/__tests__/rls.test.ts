/**
 * RLS integration tests — require a live Postgres database.
 * Run via: pnpm --filter @repo/db test
 *
 * These tests prove that an org-scoped client CANNOT read another org's data,
 * even when using the same Prisma instance.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { orgClient } from "../org-client.js";

const superClient = new PrismaClient();

let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;

beforeAll(async () => {
  // Create two isolated organizations
  const orgA = await superClient.organization.create({
    data: { name: "RLS Test Org A", slug: `rls-test-a-${Date.now()}` },
  });
  const orgB = await superClient.organization.create({
    data: { name: "RLS Test Org B", slug: `rls-test-b-${Date.now()}` },
  });
  orgAId = orgA.id;
  orgBId = orgB.id;

  // Create one user per org
  const userA = await superClient.user.create({
    data: { email: `rls-a-${Date.now()}@test.example`, name: "RLS User A" },
  });
  const userB = await superClient.user.create({
    data: { email: `rls-b-${Date.now()}@test.example`, name: "RLS User B" },
  });
  userAId = userA.id;
  userBId = userB.id;

  // Memberships (superuser bypasses RLS so these inserts go through)
  await superClient.membership.createMany({
    data: [
      { organizationId: orgAId, userId: userAId, role: "OWNER" },
      { organizationId: orgBId, userId: userBId, role: "OWNER" },
    ],
  });

  // Seed a goal in each org using the superuser (bypasses RLS)
  await superClient.goal.createMany({
    data: [
      {
        organizationId: orgAId,
        userId: userAId,
        name: "Goal A",
        targetAmount: 100000n,
        targetDate: new Date("2027-01-01"),
      },
      {
        organizationId: orgBId,
        userId: userBId,
        name: "Goal B",
        targetAmount: 200000n,
        targetDate: new Date("2027-01-01"),
      },
    ],
  });
});

afterAll(async () => {
  // Clean up in reverse dependency order
  await superClient.goal.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
  await superClient.membership.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
  await superClient.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  await superClient.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  await superClient.$disconnect();
});

describe("Row-Level Security — org isolation", () => {
  it("org A client can read org A goals", async () => {
    const db = orgClient(orgAId);
    const goals = await db.goal.findMany();
    expect(goals.length).toBeGreaterThanOrEqual(1);
    expect(goals.every((g) => g.organizationId === orgAId)).toBe(true);
  });

  it("org B client can read org B goals", async () => {
    const db = orgClient(orgBId);
    const goals = await db.goal.findMany();
    expect(goals.length).toBeGreaterThanOrEqual(1);
    expect(goals.every((g) => g.organizationId === orgBId)).toBe(true);
  });

  it("org A client cannot read org B goals", async () => {
    const db = orgClient(orgAId);
    const goals = await db.goal.findMany();
    const crossOrgGoals = goals.filter((g) => g.organizationId === orgBId);
    expect(crossOrgGoals).toHaveLength(0);
  });

  it("org B client cannot read org A goals", async () => {
    const db = orgClient(orgBId);
    const goals = await db.goal.findMany();
    const crossOrgGoals = goals.filter((g) => g.organizationId === orgAId);
    expect(crossOrgGoals).toHaveLength(0);
  });

  it("org A client cannot findUnique a goal from org B", async () => {
    // Get the goal ID from the superuser perspective
    const goalB = await superClient.goal.findFirstOrThrow({
      where: { organizationId: orgBId },
    });

    const db = orgClient(orgAId);
    const result = await db.goal.findUnique({ where: { id: goalB.id } });
    expect(result).toBeNull();
  });

  it("org A client membership query is isolated", async () => {
    const db = orgClient(orgAId);
    const members = await db.membership.findMany();
    expect(members.every((m) => m.organizationId === orgAId)).toBe(true);
  });

  it("superuser can still read across orgs (RLS bypass for migrations)", async () => {
    const goals = await superClient.goal.findMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    const orgIds = new Set(goals.map((g) => g.organizationId));
    expect(orgIds.has(orgAId)).toBe(true);
    expect(orgIds.has(orgBId)).toBe(true);
  });
});
