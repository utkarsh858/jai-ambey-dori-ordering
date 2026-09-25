# Admin Login Fix - Complete Solution

## Problem
Admin users were unable to log in. After authentication succeeded, they saw the error:
```
Administrator action required
Your sign-in succeeded, but we could not verify your application access right now.
An administrator must verify this account in Supabase and restore the profile or role.
```

**Root Cause:** The middleware was not running, so session cookies were never refreshed on the server. This caused server-side profile queries to run as unauthenticated users, hitting RLS policies that couldn't find the profile.

## Root Cause Analysis

### Session Flow Without Middleware
1. User signs in via OAuth
2. `/auth/callback` sets session cookies in response ✓
3. Browser receives cookies and stores them ✓
4. Next request to `/dashboard` arrives
5. **PROBLEM:** Middleware doesn't run → cookies never passed to Supabase
6. Server components run as **unauthenticated** users
7. RLS policy `own profile only` returns 0 rows
8. `.single()` throws: `'JSON object requested, multiple (or no) rows returned'`
9. User sees diagnostic error

### Session Flow With Middleware Fix
1. User signs in via OAuth
2. `/auth/callback` sets session cookies in response ✓
3. Browser receives cookies and stores them ✓
4. Next request to `/dashboard` arrives
5. **MIDDLEWARE RUNS** → Calls `supabase.auth.getUser()` 
6. Middleware **refreshes** session cookies in response ✓
7. Server components run as **authenticated** users
8. RLS policy `own profile only` finds the profile ✓
9. User routes to `/admin` (or `/buyer`, `/manager`)

## Changes Made

### 1. Enable Middleware (CRITICAL)
**File:** `src/middleware.ts` (renamed from `src/proxy.ts`)

```typescript
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  // ... create Supabase client with response-aware cookies ...
  await supabase.auth.getUser(); // Refresh session
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

**Why:** Next.js only runs files named `middleware.ts` (not `proxy.ts`) as middleware. The renamed file now runs on every request to refresh the session.

### 2. Explicit User ID Filters (Defense)
Added `.eq("id", user.id)` to all profile queries:
- `src/app/dashboard/page.tsx` - Uses `.maybeSingle()` for dashboard routing
- `src/app/admin/page.tsx` - Loads current user's role
- `src/app/manager/page.tsx` - Loads current user's profile
- `src/app/buyer/page.tsx` - Loads current user's profile

**Why:** Explicitly filtering by user ID ensures the query is specific and doesn't rely on implicit RLS filtering when cookies might be stale.

### 3. Enhanced Error Logging (Debugging)
Added detailed error logging to dashboard:
```typescript
if (!user || profileError || !profile) {
  console.error("Dashboard access issue:", {
    hasUser: Boolean(user),
    userId: user?.id || "NULL",
    userEmail: user?.email || "NULL",
    authError: authError?.message || null,
    profileError: profileError?.message || null,
    profileErrorCode: profileError?.code || null,
    profileErrorDetails: profileError?.details || null,
  });
}
```

**Why:** Captures exact error messages in Vercel logs for future diagnostics.

## Verification Steps

### For Vercel Deployment
1. Wait for Vercel to deploy commit `fb84778` (latest)
2. Sign out completely and close browser
3. Open fresh **Incognito window**
4. Sign in with admin credentials
5. **Expected:** Redirected to `/admin` dashboard (NOT the error page)
6. Check Vercel function logs for any errors

### For Local Testing
```bash
npm run build    # ✓ Should pass
npm test         # ✓ Should pass (12 tests including middleware tests)
npm run lint     # ✓ Should pass
```

### Supabase Verification (if issues persist)
In SQL Editor, test the exact query flow:
```sql
-- Verify profile exists
select id, role from public.profiles 
where id = '37f09063-054a-471b-98d3-b6b5137511d2';

-- Test RLS with authenticated context
begin;
set local role authenticated;
set local request.jwt.claim.sub = '37f09063-054a-471b-98d3-b6b5137511d2';
select id, role from public.profiles where id = auth.uid();
rollback;
```

Expected: One row with `role = 'admin'`

## Commits in This Fix

| Commit | Change |
|--------|--------|
| `2eb6aa0` | **CRITICAL:** Renamed `proxy.ts` → `middleware.ts` with proper export |
| `25093f8` | Added explicit `.eq("id", user.id)` to all profile queries |
| `b26c737` | Added detailed error logging for debugging |
| `fb84778` | Added middleware export verification tests |

## Why This Works

**Next.js Middleware Lifecycle:**
```
HTTP Request
    ↓
Middleware runs (if exported as `middleware`)
    ↓
Route handler or Server Component
    ↓
HTTP Response
```

**Supabase SSR Cookie Refresh:**
- Middleware calls `supabase.auth.getUser()`
- This validates the current session and refreshes the JWT
- The JWT is written to response cookies via `response.cookies.set()`
- Browser stores the refreshed cookie
- Server components can now read `await cookies()` and get the authenticated session

Without middleware, this refresh never happens, and the server has no way to know the user is authenticated.

## Testing the Fix

### Browser DevTools Verification
1. Open DevTools → Application → Cookies
2. Look for `sb-*-auth-token`
3. Should have value like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. After sign-in, this cookie should be present
5. Middleware will refresh it on each request

### Vercel Logs Verification
1. Go to Vercel → Deployments → Latest → Logs
2. Sign in as admin in fresh Incognito window
3. Look for either:
   - **Success:** No error logs, then `GET /admin` request (200 OK)
   - **Debug:** `Dashboard access issue:` error log with details

### Success Criteria
- ✓ Sign in completes without redirect loop
- ✓ Admin user is routed to `/admin`
- ✓ Dashboard shows "Factory operations" page
- ✓ Buyer/Manager users route to `/buyer` and `/manager`
- ✓ No "Administrator action required" error

## If Still Failing After Deployment

1. **Verify deployment:** Check Vercel deploy timestamp is after this fix
2. **Check env vars:** Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set in Vercel
3. **Check profile:** Verify profile exists in Supabase with role=admin
4. **Browser cache:** Try Incognito/Private window, clear cookies, restart browser
5. **Hard refresh:** In browser, Ctrl+Shift+Delete to clear all storage

## Long-term Robustness

This fix is robust because:
- ✓ Middleware automatically runs on every request
- ✓ Explicit `.eq("id", user.id)` filters avoid RLS edge cases
- ✓ Error logging captures exact issues for future debugging
- ✓ Test coverage validates middleware is properly exported
