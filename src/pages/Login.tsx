/**
 * Sign in. The card and the copy are the same either way — only the form
 * inside changes, depending on whether Clerk holds the credential (see
 * lib/clerk.ts). `CLERK_ENABLED` is a build-time constant, so the two forms
 * are never swapped at runtime.
 */

import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { afterAuthPath, CLERK_ENABLED } from "../lib/clerk";
import { ClerkLoginForm } from "./auth/ClerkLoginForm";
import { ClerkSessionGuard } from "./auth/ClerkSessionGuard";
import { PasswordLoginForm } from "./auth/PasswordLoginForm";

export default function Login() {
  const [params] = useSearchParams();
  // A Google connect attempt that failed redirects here with its reason.
  const initialError = params.get("connect_error");
  const next = afterAuthPath(params.get("next"));
  const signupLink = next === "/app" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      page="login"
      title="Sign in"
      subtitle={CLERK_ENABLED ? "Continue with Google, or use your email." : "Welcome back."}
      footer={
        <>
          New here?{" "}
          <Link to={signupLink} className="font-medium text-ink hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {CLERK_ENABLED ? (
        <ClerkSessionGuard>
          <ClerkLoginForm initialError={initialError} afterAuth={next} />
        </ClerkSessionGuard>
      ) : (
        <PasswordLoginForm initialError={initialError} afterAuth={next} />
      )}
    </AuthShell>
  );
}
