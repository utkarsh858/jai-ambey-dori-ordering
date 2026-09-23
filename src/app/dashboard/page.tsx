import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dashboardForRole } from "@/lib/permissions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").single();
  if (!profile) redirect("/login");
  redirect(dashboardForRole[profile.role as keyof typeof dashboardForRole]);
}
