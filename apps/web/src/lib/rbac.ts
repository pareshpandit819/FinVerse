import { auth } from "@/lib/auth";
import { prisma } from "@repo/db/client";
import { hasPermission } from "@repo/shared/rbac";
import type { Permission, Role } from "@repo/shared/rbac";

export type { Permission, Role };

export class PermissionDeniedError extends Error {
  readonly status = 403;
  constructor(permission: Permission) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthenticated");
    this.name = "UnauthenticatedError";
  }
}

export class MfaRequiredError extends Error {
  readonly status = 403;
  constructor() {
    super("MFA verification required");
    this.name = "MfaRequiredError";
  }
}

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: Role;
  mfaVerified: boolean;
}

/**
 * Resolves the caller's auth context for the current request.
 * Returns the session user, their membership in the given org, and MFA status.
 */
export async function getAuthContext(organizationId: string): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthenticatedError();

  const membership = await prisma.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) throw new PermissionDeniedError("org.update");

  return {
    userId: session.user.id,
    organizationId,
    role: membership.role as Role,
    mfaVerified: session.user.mfaVerified,
  };
}

/**
 * Asserts the caller has the required permission in the given org.
 * Throws PermissionDeniedError (403) or UnauthenticatedError (401) on failure.
 *
 * Usage in a Route Handler:
 *   const ctx = await requirePermission(orgId, 'budget.write.own');
 */
export async function requirePermission(
  organizationId: string,
  permission: Permission
): Promise<AuthContext> {
  const ctx = await getAuthContext(organizationId);

  if (!hasPermission(ctx.role, permission)) {
    throw new PermissionDeniedError(permission);
  }

  return ctx;
}

/**
 * Like requirePermission, but also asserts MFA has been verified.
 * Use for sensitive operations (account management, member management, etc.)
 */
export async function requirePermissionWithMfa(
  organizationId: string,
  permission: Permission
): Promise<AuthContext> {
  const ctx = await requirePermission(organizationId, permission);

  if (!ctx.mfaVerified) {
    const hasMfa = await prisma.mfaSecret.findFirst({
      where: { userId: ctx.userId, verified: true },
    });
    if (hasMfa) throw new MfaRequiredError();
  }

  return ctx;
}

/**
 * Converts thrown auth errors to JSON Response objects.
 * Wrap route handlers with this for consistent error serialization.
 */
export function withAuthErrors<T>(fn: () => Promise<T>): Promise<T | Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof UnauthenticatedError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PermissionDeniedError || err instanceof MfaRequiredError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  });
}
