import { signIn, signInWithGoogle, signUp } from "@/app/auth/actions";
import { loginMessageForCode } from "@/lib/permissions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const params = await searchParams;
  const error = loginMessageForCode(params.error);
  return <main className="auth"><section><p className="eyebrow">JAI AMBEY DORI</p><h1>Factory ordering</h1>
    {error && <p className="error">{error}</p>}{params.notice && <p className="notice">{params.notice}</p>}
    <form action={signIn} className="stack"><label>Email<input name="email" type="email" required /></label><label>Password<input name="password" type="password" minLength={12} required /></label><button>Sign in</button></form>
    <form action={signInWithGoogle}><button className="secondary">Continue with Google</button></form>
    <details><summary>New buyer?</summary><form action={signUp} className="stack"><label>Email<input name="email" type="email" required /></label><label>Create password<input name="password" type="password" minLength={12} required /></label><button>Create account</button></form></details>
  </section></main>;
}
