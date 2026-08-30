/**
 * Sign in. The card, the painting and the copy are the same either way — only
 * the form inside changes, depending on whether Clerk holds the credential
 * (see lib/clerk.ts). `CLERK_ENABLED` is a build-time constant, so the two
 * forms are never swapped at runtime.
 */

import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/auth/AuthShell";
import { CLERK_ENABLED } from "../lib/clerk";
import { ClerkLoginForm } from "./auth/ClerkLoginForm";
import { PasswordLoginForm } from "./auth/PasswordLoginForm";

export default function Login() {
  const [params] = useSearchParams();
  // A Google connect attempt that failed redirects here with its reason.
  const initialError = params.get("connect_error");

  return (
    <AuthShell
      page="login"
      caption="Every model on your plan, one login."
      captionSub="Your connected accounts, chats and API keys are where you left them."
      eyebrow="Welcome Back"
      title="Sign In to Ohshi"
      subtitle={
        CLERK_ENABLED
          ? "Continue with a provider, or use your email."
          : "Use the email and password you signed up with."
      }
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-semibold text-accent hover:underline">
            Create an Account
          </Link>
        </>
      }
    >
      {CLERK_ENABLED ? (
        <ClerkLoginForm initialError={initialError} />
      ) : (
        <PasswordLoginForm initialError={initialError} />
      )}
    </AuthShell>
  );
}
