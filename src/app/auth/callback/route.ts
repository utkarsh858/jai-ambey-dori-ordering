import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=callback_failed", request.url));

  const env = getPublicEnv();
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
  
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=callback_failed", request.url));

  return response;
}
