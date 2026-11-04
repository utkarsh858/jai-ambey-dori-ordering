// Keep users signed in for a long time: persistent cookie (400 days, the browser maximum).
export const SESSION_COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 400,
  path: "/",
  sameSite: "lax" as const,
};
