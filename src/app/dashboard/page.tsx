import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveDashboardAccess } from "@/lib/access";
import { AccessDiagnostic } from "@/app/dashboard/access-diagnostic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  const { data: profile, error: profileError } = user
    ? await supabase.from("profiles").select("role").maybeSingle()
    : { data: null, error: null };
  const access = resolveDashboardAccess({
    hasUser: Boolean(user),
    authError: Boolean(authError),
    profile,
    profileError: Boolean(profileError),
  });

  if (access.kind === "route") redirect(access.destination);
  if (access.kind === "sign-in-required") {
    redirect(`/login?error=${access.reason === "invalid-session" ? "session_expired" : "signin_required"}`);
  }

  return <AccessDiagnostic reason={access.reason} />;
}
