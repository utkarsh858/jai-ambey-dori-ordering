"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({ email: z.email(), password: z.string().min(12) });

export async function signIn(formData: FormData) {
  const input = credentials.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input);
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const input = credentials.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...input,
    options: { emailRedirectTo: `${(await headers()).get("origin")}/auth/callback` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/login?notice=Check your inbox to confirm your email.");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${(await headers()).get("origin")}/auth/callback` },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? "Unable to start Google sign-in")}`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
