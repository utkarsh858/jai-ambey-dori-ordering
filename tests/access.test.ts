import { describe, expect, it } from "vitest";
import { resolveDashboardAccess } from "../src/lib/access";
import { loginMessageForCode } from "../src/lib/permissions";

describe("resolveDashboardAccess", () => {
  it("keeps missing and invalid sessions distinct", () => {
    expect(resolveDashboardAccess({ hasUser: false, authError: false, profile: null, profileError: false }))
      .toEqual({ kind: "sign-in-required", reason: "missing-session" });
    expect(resolveDashboardAccess({ hasUser: false, authError: true, profile: null, profileError: false }))
      .toEqual({ kind: "sign-in-required", reason: "invalid-session" });
  });

  it("does not turn profile problems into a sign-in redirect", () => {
    expect(resolveDashboardAccess({ hasUser: true, authError: false, profile: null, profileError: false }))
      .toEqual({ kind: "profile-problem", reason: "missing-profile" });
    expect(resolveDashboardAccess({ hasUser: true, authError: false, profile: null, profileError: true }))
      .toEqual({ kind: "profile-problem", reason: "profile-unavailable" });
    expect(resolveDashboardAccess({
      hasUser: true,
      authError: false,
      profile: { role: "legacy_role" },
      profileError: false,
    })).toEqual({ kind: "profile-problem", reason: "unknown-role" });
  });

  it("routes known roles to their dashboards", () => {
    expect(resolveDashboardAccess({
      hasUser: true,
      authError: false,
      profile: { role: "admin" },
      profileError: false,
    })).toEqual({ kind: "route", destination: "/admin" });
  });
});

describe("loginMessageForCode", () => {
  it("uses fixed public messages and ignores arbitrary query values", () => {
    expect(loginMessageForCode("signin_failed")).toContain("Unable to sign in");
    expect(loginMessageForCode("user@example.com exists")).toBeUndefined();
  });
});
