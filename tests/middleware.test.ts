import { describe, it, expect, vi } from "vitest";

describe("Middleware", () => {
  it("should be properly exported", async () => {
    const middleware = await import("../src/middleware");
    expect(middleware.middleware).toBeDefined();
    expect(typeof middleware.middleware).toBe("function");
  });

  it("should have correct matcher config", async () => {
    const middleware = await import("../src/middleware");
    expect(middleware.config).toBeDefined();
    expect(middleware.config.matcher).toBeDefined();
    expect(Array.isArray(middleware.config.matcher)).toBe(true);
  });

  it("should include matcher pattern for all routes except static", async () => {
    const middleware = await import("../src/middleware");
    const matcher = middleware.config.matcher[0];
    expect(matcher).toContain("_next/static");
    expect(matcher).toContain("_next/image");
    expect(matcher).toContain("favicon.ico");
  });
});
