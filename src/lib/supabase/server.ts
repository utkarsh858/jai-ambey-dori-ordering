import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot mutate cookies; proxy refreshes sessions.
        }
      },
    },
  });
}
