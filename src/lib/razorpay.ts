import crypto from "node:crypto";
import Razorpay from "razorpay";
import { z } from "zod";

const razorpaySchema = z.object({
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
});

export function razorpay() {
  const keys = razorpaySchema.parse(process.env);
  return new Razorpay({ key_id: keys.RAZORPAY_KEY_ID, key_secret: keys.RAZORPAY_KEY_SECRET });
}

export function verifyRazorpayWebhook(rawBody: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
