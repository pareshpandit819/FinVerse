import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@repo/db/client";

const ORG_COOKIE = "efd-active-org";

export interface ActiveOrg {
  id: string;
  name: string;
  slug: string;
  role: string;
}

/**
 * Resolves the active organization for the current session.
 * Priority: URL orgId param → cookie → first membership.
 * Returns null if the user has no org memberships.
 */
export async function getActiveOrg(orgIdHint?: string | null): Promise<ActiveOrg | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_COOKIE)?.value;
  const targetId = orgIdHint ?? cookieOrgId ?? memberships[0]!.organizationId;

  const membership = memberships.find((m) => m.organizationId === targetId) ?? memberships[0]!;

  return {
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    role: membership.role,
  };
}

export async function getUserMemberships(userId: string): Promise<ActiveOrg[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));
}
