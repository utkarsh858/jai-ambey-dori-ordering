import { describe, it, expect } from "vitest";
import { resolveDashboardAccess } from "../src/lib/access";

describe("Admin login flow after middleware fix", () => {
  it("should resolve admin profile to /admin route", () => {
    const adminAccess = resolveDashboardAccess({
      hasUser: true,
      authError: false,
      profile: { role: "admin" },
      profileError: false,
    });
    
    expect(adminAccess.kind).toBe("route");
    if (adminAccess.kind === "route") {
      expect(adminAccess.destination).toBe("/admin");
    }
  });

  it("should resolve buyer profile to /buyer route", () => {
    const buyerAccess = resolveDashboardAccess({
      hasUser: true,
      authError: false,
      profile: { role: "buyer" },
      profileError: false,
    });
    
    expect(buyerAccess.kind).toBe("route");
    if (buyerAccess.kind === "route") {
      expect(buyerAccess.destination).toBe("/buyer");
    }
  });

  it("should resolve manager profile to /manager route", () => {
    const managerAccess = resolveDashboardAccess({
      hasUser: true,
      authError: false,
      profile: { role: "item_manager" },
      profileError: false,
    });
    
    expect(managerAccess.kind).toBe("route");
    if (managerAccess.kind === "route") {
      expect(managerAccess.destination).toBe("/manager");
    }
  });

  it("should return profile-unavailable when profileError is true (reproduces original bug)", () => {
    // This simulates the original error: profile query failed on server
    const buggyAccess = resolveDashboardAccess({
      hasUser: true,
      authError: false,
      profile: null,
      profileError: true, // The error that was happening before middleware fix
    });
    
    expect(buggyAccess.kind).toBe("profile-problem");
    if (buggyAccess.kind === "profile-problem") {
      expect(buggyAccess.reason).toBe("profile-unavailable");
    }
  });

  it("should show diagnostic message when profile unavailable (after fix)", () => {
    // After middleware fix, if profile query still fails, user sees diagnostic
    const diagnosticAccess = resolveDashboardAccess({
      hasUser: true,
      authError: false,
      profile: null,
      profileError: true,
    });
    
    expect(diagnosticAccess.kind).toBe("profile-problem");
    if (diagnosticAccess.kind === "profile-problem") {
      expect(diagnosticAccess.reason).toBe("profile-unavailable");
    }
  });

  it("should handle missing user gracefully", () => {
    const noUserAccess = resolveDashboardAccess({
      hasUser: false,
      authError: false,
      profile: null,
      profileError: false,
    });
    
    expect(noUserAccess.kind).toBe("sign-in-required");
  });
});
