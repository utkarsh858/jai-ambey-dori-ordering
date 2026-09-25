"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().trim().email(),
  password: z.string().min(12),
});

function loginRedirect(error: "invalid_form" | "signin_failed" | "signup_failed" | "oauth_failed") {
  redirect(`/login?error=${error}`);
}

export async function signIn(formData: FormData) {
  const input = credentials.safeParse(Object.fromEntries(formData));
  if (!input.success) {
    loginRedirect("invalid_form");
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input.data);
  if (error) {
    loginRedirect("signin_failed");
    return;
  }
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const input = credentials.safeParse(Object.fromEntries(formData));
  if (!input.success) {
    loginRedirect("invalid_form");
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...input.data,
    options: { emailRedirectTo: `${(await headers()).get("origin")}/auth/callback` },
  });
  if (error) {
    loginRedirect("signup_failed");
    return;
  }
  redirect("/login?notice=Check your inbox to confirm your email.");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${(await headers()).get("origin")}/auth/callback` },
  });
  if (error || !data.url) {
    loginRedirect("oauth_failed");
    return;
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
