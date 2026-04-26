export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type Permission =
  | "org.delete"
  | "org.update"
  | "member.invite"
  | "member.remove"
  | "member.role.update"
  | "account.read.any"
  | "account.read.own"
  | "account.write.any"
  | "account.write.own"
  | "transaction.read.any"
  | "transaction.read.own"
  | "transaction.write.any"
  | "transaction.write.own"
  | "goal.write.any"
  | "goal.write.own"
  | "budget.write.any"
  | "budget.write.own"
  | "insight.read.any"
  | "insight.read.own"
  | "audit.read"
  | "settings.mfa";

const PERMISSIONS: Record<Role, Set<Permission>> = {
  OWNER: new Set([
    "org.delete",
    "org.update",
    "member.invite",
    "member.remove",
    "member.role.update",
    "account.read.any",
    "account.read.own",
    "account.write.any",
    "account.write.own",
    "transaction.read.any",
    "transaction.read.own",
    "transaction.write.any",
    "transaction.write.own",
    "goal.write.any",
    "goal.write.own",
    "budget.write.any",
    "budget.write.own",
    "insight.read.any",
    "insight.read.own",
    "audit.read",
    "settings.mfa",
  ]),
  ADMIN: new Set([
    "org.update",
    "member.invite",
    "member.remove",
    "member.role.update",
    "account.read.any",
    "account.read.own",
    "account.write.any",
    "account.write.own",
    "transaction.read.any",
    "transaction.read.own",
    "transaction.write.any",
    "transaction.write.own",
    "goal.write.any",
    "goal.write.own",
    "budget.write.any",
    "budget.write.own",
    "insight.read.any",
    "insight.read.own",
    "audit.read",
    "settings.mfa",
  ]),
  MEMBER: new Set([
    "account.read.own",
    "account.write.own",
    "transaction.read.own",
    "transaction.write.own",
    "goal.write.own",
    "budget.write.own",
    "insight.read.own",
    "settings.mfa",
  ]),
  VIEWER: new Set([
    "account.read.own",
    "transaction.read.own",
    "settings.mfa",
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.has(permission) ?? false;
}

export function getRolePermissions(role: Role): Set<Permission> {
  return PERMISSIONS[role] ?? new Set();
}

/** Returns true if the role can act on any member's resources (not just their own). */
export function canActOnAny(role: Role, resource: "account" | "transaction" | "goal" | "budget" | "insight"): boolean {
  const anyPerm = `${resource}.read.any` as Permission;
  return hasPermission(role, anyPerm);
}
