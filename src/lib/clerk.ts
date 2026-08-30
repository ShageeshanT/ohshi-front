/**
 * Clerk, behind one build-time flag.
 *
 * `VITE_CLERK_PUBLISHABLE_KEY` unset (the default) and the app signs in the way
 * it always has: email and password against `/api/auth/*`, with a cookie
 * session. Set it and Clerk holds the credentials instead — the same pages, the
 * same markup, different plumbing.
 *
 * It is a constant, not state: Vite bakes it in at build time and it cannot
 * change while the tab is open, so a component may branch on `CLERK_ENABLED`
 * and the hook order still never varies between renders. The backend must agree
 * (`OHSHI_CLERK_PUBLISHABLE_KEY`); `/api/auth/me` reports which side it is on as
 * `config.authProvider`, and App.tsx warns when the two disagree.
 */

const KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "").trim();

export const CLERK_PUBLISHABLE_KEY = KEY;
export const CLERK_ENABLED = KEY.length > 0;

/** Where Clerk sends the browser back to once a social sign-in completes. */
export const SSO_CALLBACK_PATH = "/sso-callback";
export const AFTER_AUTH_PATH = "/app";

/**
 * The social providers enabled in the Clerk dashboard. Keep this list in step
 * with **SSO Connections** there — a button here for a provider Clerk has
 * switched off renders fine but errors on click. Adding one means adding its
 * mark to `SOCIAL_ICONS` in components/auth/AuthBits.tsx.
 */
export const SOCIAL_PROVIDERS = [{ strategy: "oauth_google", label: "Google" }] as const;

export type SocialStrategy = (typeof SOCIAL_PROVIDERS)[number]["strategy"];

/** Anything Clerk hands back as an error, reduced to one line for the form. */
export function clerkMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  const e = error as { longMessage?: string; long_message?: string; message?: string; errors?: unknown[] };
  const first = Array.isArray(e.errors) && e.errors.length > 0 ? e.errors[0] : null;
  if (first) return clerkMessage(first, fallback);
  return e.longMessage || e.long_message || e.message || fallback;
}

/**
 * The one way frontend and backend can disagree: the API has Clerk switched on
 * (it answers 409) but this bundle was built without `VITE_CLERK_PUBLISHABLE_KEY`,
 * so it is still showing the password form. Always a deploy fault, never the
 * visitor's — say something true to them and put the fix in the console.
 *
 * Almost always the Docker build did not receive the key: it is baked in at
 * build time, so it needs the `ARG` in the frontend Dockerfile, and the
 * variable must be named VITE_CLERK_PUBLISHABLE_KEY (not the NEXT_PUBLIC_…
 * name Clerk's dashboard suggests when the framework picker says Next.js).
 */
export function buildMismatch(error: unknown): string | null {
  if ((error as { status?: number } | null)?.status !== 409) return null;
  console.error(
    "Sign-in is misconfigured: the API expects Clerk but this bundle was built " +
      "without VITE_CLERK_PUBLISHABLE_KEY. Set it on the frontend service and REBUILD " +
      "(it is compiled in, not read at runtime). See backend/docs/CLERK.md.",
  );
  return "Sign-in is being updated right now. Please try again in a few minutes.";
}
