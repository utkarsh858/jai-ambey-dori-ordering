import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpayWebhook } from "../src/lib/razorpay";

describe("verifyRazorpayWebhook", () => {
  it("accepts an authentic Razorpay webhook", () => {
    const body = '{"event":"payment.captured"}';
    const secret = "webhook-secret";
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyRazorpayWebhook(body, signature, secret)).toBe(true);
  });

  it("rejects a tampered webhook", () => {
    expect(verifyRazorpayWebhook("tampered", "a".repeat(64), "webhook-secret")).toBe(false);
  });
});
