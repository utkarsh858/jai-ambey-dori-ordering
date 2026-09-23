import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServiceRoleKey } from "@/lib/env";

export function createAdminClient() {
  const env = getPublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
