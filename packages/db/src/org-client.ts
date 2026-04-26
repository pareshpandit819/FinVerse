import { prisma } from "./client.js";
import type { PrismaClient } from "@prisma/client";

/**
 * Returns a Prisma client scoped to a specific organization.
 * Every operation executed through the returned client runs inside a
 * transaction that first sets `app.current_org_id`, which the Postgres
 * RLS policies read via app_current_org_id().
 *
 * Usage:
 *   const db = orgClient(orgId);
 *   const txns = await db.transaction.findMany({ where: { date: ... } });
 */
export function orgClient(organizationId: string): PrismaClient {
  return new Proxy(prisma, {
    get(target, prop) {
      const value = target[prop as keyof PrismaClient];

      // Wrap $transaction to inject org context
      if (prop === "$transaction") {
        return (arg: unknown, options?: unknown) => {
          if (typeof arg === "function") {
            return target.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
              return (arg as (tx: typeof tx) => Promise<unknown>)(tx);
            }, options as Parameters<typeof target.$transaction>[1]);
          }
          // Array of operations — wrap in a transaction that sets org context first
          return target.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
            return Promise.all(
              (arg as Array<ReturnType<typeof tx.$queryRaw>>).map((op) => op)
            );
          });
        };
      }

      // For model delegates (prisma.transaction, prisma.goal, etc.)
      // wrap each operation to set org context in a transaction
      if (
        typeof value === "object" &&
        value !== null &&
        typeof prop === "string" &&
        !prop.startsWith("$") &&
        !["_middlewares", "_engine", "_errorFormat", "_clientVersion", "_activeProvider"].includes(prop)
      ) {
        return wrapModelDelegate(target, organizationId, prop);
      }

      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(target);
      }
      return value;
    },
  }) as PrismaClient;
}

function wrapModelDelegate(
  client: PrismaClient,
  organizationId: string,
  modelName: string
): Record<string, (...args: unknown[]) => Promise<unknown>> {
  const delegate = client[modelName as keyof PrismaClient] as Record<string, (...args: unknown[]) => Promise<unknown>>;

  return new Proxy(delegate, {
    get(target, method) {
      const fn = target[method as string];
      if (typeof fn !== "function") return fn;

      return (...args: unknown[]) =>
        client.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`;
          const txDelegate = tx[modelName as keyof typeof tx] as Record<string, (...a: unknown[]) => Promise<unknown>>;
          return txDelegate[method as string]?.(...args);
        });
    },
  });
}
