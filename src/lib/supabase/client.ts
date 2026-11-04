import { createBrowserClient } from "@supabase/ssr";
import { SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { getPublicEnv } from "@/lib/env";

export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookieOptions: SESSION_COOKIE_OPTIONS });
}
