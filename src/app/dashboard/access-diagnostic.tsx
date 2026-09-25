import { signOut } from "@/app/auth/actions";
import type { DashboardAccess } from "@/lib/access";

const messageForReason = {
  "missing-profile": "Your sign-in succeeded, but your account does not have an application profile yet.",
  "profile-unavailable": "Your sign-in succeeded, but we could not verify your application access right now.",
  "unknown-role": "Your sign-in succeeded, but your account has an unsupported application role.",
} as const;

export function AccessDiagnostic({
  reason,
}: {
  reason: Extract<DashboardAccess, { kind: "profile-problem" }>["reason"];
}) {
  return (
    <main className="auth">
      <section>
        <p className="eyebrow">ACCOUNT ACCESS</p>
        <h1>Administrator action required</h1>
        <p className="error">{messageForReason[reason]}</p>
        <p className="privacy">
          An administrator must verify this account in Supabase and restore the profile or role. No access has been
          granted while this is unresolved.
        </p>
        <form action={signOut}>
          <button className="secondary">Sign out</button>
        </form>
      </section>
    </main>
  );
}
