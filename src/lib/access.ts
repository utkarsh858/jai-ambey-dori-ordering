import { dashboardForRole } from "./permissions";

export type ProfileRole = string | null | undefined;

export type DashboardAccess =
  | { kind: "route"; destination: (typeof dashboardForRole)[keyof typeof dashboardForRole] }
  | { kind: "sign-in-required"; reason: "missing-session" | "invalid-session" }
  | { kind: "profile-problem"; reason: "missing-profile" | "profile-unavailable" | "unknown-role" };

export function resolveDashboardAccess({
  hasUser,
  authError,
  profile,
  profileError,
}: {
  hasUser: boolean;
  authError: boolean;
  profile: { role: ProfileRole } | null;
  profileError: boolean;
}): DashboardAccess {
  if (!hasUser) {
    return { kind: "sign-in-required", reason: authError ? "invalid-session" : "missing-session" };
  }

  if (profileError) return { kind: "profile-problem", reason: "profile-unavailable" };
  if (!profile) return { kind: "profile-problem", reason: "missing-profile" };

  const destination = dashboardForRole[profile.role as keyof typeof dashboardForRole];
  if (!destination) return { kind: "profile-problem", reason: "unknown-role" };

  return { kind: "route", destination };
}
