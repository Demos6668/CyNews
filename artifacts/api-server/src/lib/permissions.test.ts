import { describe, it, expect } from "vitest";
import { can, assertCan, ForbiddenError, ROLE_ORDER, type Role, type Action } from "./permissions";

describe("ROLE_ORDER", () => {
  it("has the expected ascending order", () => {
    expect(ROLE_ORDER).toEqual(["viewer", "analyst", "admin", "owner"]);
  });
});

describe("can()", () => {
  // viewer
  it("viewer can read advisories", () => {
    expect(can("viewer", "advisory:read")).toBe(true);
  });
  it("viewer cannot update advisory status", () => {
    expect(can("viewer", "advisory:update_status")).toBe(false);
  });
  it("viewer cannot manage billing", () => {
    expect(can("viewer", "billing:manage")).toBe(false);
  });

  // analyst
  it("analyst can update advisory status", () => {
    expect(can("analyst", "advisory:update_status")).toBe(true);
  });
  it("analyst cannot create workspace", () => {
    expect(can("analyst", "workspace:create")).toBe(false);
  });
  it("analyst cannot manage billing", () => {
    expect(can("analyst", "billing:manage")).toBe(false);
  });

  // admin
  it("admin can create workspace", () => {
    expect(can("admin", "workspace:create")).toBe(true);
  });
  it("admin can invite member", () => {
    expect(can("admin", "member:invite")).toBe(true);
  });
  it("admin cannot delete org", () => {
    expect(can("admin", "org:delete")).toBe(false);
  });
  it("admin cannot manage billing", () => {
    expect(can("admin", "billing:manage")).toBe(false);
  });

  // owner
  it("owner can delete org", () => {
    expect(can("owner", "org:delete")).toBe(true);
  });
  it("owner can manage billing", () => {
    expect(can("owner", "billing:manage")).toBe(true);
  });

  // every role can read
  const readableActions: Action[] = [
    "advisory:read",
    "news:read",
    "threat:read",
    "workspace:read",
    "org:read",
    "member:read",
  ];
  for (const action of readableActions) {
    for (const role of ROLE_ORDER as Role[]) {
      it(`${role} can ${action}`, () => {
        expect(can(role, action)).toBe(true);
      });
    }
  }
});

describe("assertCan()", () => {
  it("does not throw when allowed", () => {
    expect(() => assertCan("admin", "workspace:create")).not.toThrow();
  });

  it("throws ForbiddenError when denied", () => {
    expect(() => assertCan("viewer", "advisory:update_status")).toThrow(ForbiddenError);
  });

  it("thrown error carries action and role", () => {
    try {
      assertCan("analyst", "billing:manage");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      const fbErr = err as ForbiddenError;
      expect(fbErr.action).toBe("billing:manage");
      expect(fbErr.role).toBe("analyst");
      expect(fbErr.statusCode).toBe(403);
    }
  });
});
