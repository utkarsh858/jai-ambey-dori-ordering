export const dashboardForRole = {
  buyer: "/buyer",
  admin: "/admin",
  item_manager: "/manager",
} as const;

export function loginMessageForCode(code?: string) {
  const messages = {
    invalid_form: "Enter a valid email address and a password with at least 12 characters.",
    signin_failed: "Unable to sign in. Check your credentials and complete email confirmation if required.",
    signin_required: "Sign in to continue.",
    session_expired: "Your session is invalid or has expired. Please sign in again.",
    signup_failed: "Unable to create the account. Please try again later.",
    oauth_failed: "Unable to start Google sign-in. Please try again later.",
    callback_failed: "Unable to complete sign-in. Please try again.",
  } as const;

  return code && code in messages ? messages[code as keyof typeof messages] : undefined;
}
