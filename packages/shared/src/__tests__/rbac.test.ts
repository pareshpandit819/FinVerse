import { describe, it, expect } from "vitest";
import { hasPermission, getRolePermissions, canActOnAny } from "../rbac.js";

describe("hasPermission", () => {
  it("OWNER has all permissions", () => {
    expect(hasPermission("OWNER", "org.delete")).toBe(true);
    expect(hasPermission("OWNER", "audit.read")).toBe(true);
    expect(hasPermission("OWNER", "plaid.link")).toBe(true);
  });

  it("VIEWER cannot write goals", () => {
    expect(hasPermission("VIEWER", "goal.write.own")).toBe(false);
    expect(hasPermission("VIEWER", "goal.write.any")).toBe(false);
  });

  it("VIEWER cannot link Plaid", () => {
    expect(hasPermission("VIEWER", "plaid.link")).toBe(false);
  });

  it("MEMBER can write own goals but not any", () => {
    expect(hasPermission("MEMBER", "goal.write.own")).toBe(true);
    expect(hasPermission("MEMBER", "goal.write.any")).toBe(false);
  });

  it("ADMIN can read audit log", () => {
    expect(hasPermission("ADMIN", "audit.read")).toBe(true);
  });

  it("MEMBER cannot read audit log", () => {
    expect(hasPermission("MEMBER", "audit.read")).toBe(false);
  });

  it("MEMBER cannot delete org", () => {
    expect(hasPermission("MEMBER", "org.delete")).toBe(false);
  });

  it("ADMIN cannot delete org", () => {
    expect(hasPermission("ADMIN", "org.delete")).toBe(false);
  });

  it("OWNER can delete org", () => {
    expect(hasPermission("OWNER", "org.delete")).toBe(true);
  });

  it("returns false for unknown role", () => {
    // @ts-expect-error testing invalid role
    expect(hasPermission("SUPERADMIN", "org.delete")).toBe(false);
  });
});

describe("getRolePermissions", () => {
  it("VIEWER has fewer permissions than MEMBER", () => {
    const viewer = getRolePermissions("VIEWER");
    const member = getRolePermissions("MEMBER");
    expect(viewer.size).toBeLessThan(member.size);
  });

  it("OWNER has strictly more permissions than ADMIN", () => {
    const owner = getRolePermissions("OWNER");
    const admin = getRolePermissions("ADMIN");
    expect(owner.size).toBeGreaterThan(admin.size);
    // Every admin permission should be in owner
    for (const perm of admin) {
      expect(owner.has(perm)).toBe(true);
    }
  });
});

describe("canActOnAny", () => {
  it("OWNER can act on any account", () => {
    expect(canActOnAny("OWNER", "account")).toBe(true);
  });

  it("MEMBER cannot act on any account", () => {
    expect(canActOnAny("MEMBER", "account")).toBe(false);
  });

  it("ADMIN can act on any goal", () => {
    expect(canActOnAny("ADMIN", "goal")).toBe(true);
  });
});
