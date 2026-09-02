/**
 * Create an account. As with the sign-in page, the shell is shared and only
 * the form inside depends on which engine holds the credential.
 */

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../App";
import { AuthShell } from "../components/auth/AuthShell";
import { get } from "../lib/api";
import { afterAuthPath, CLERK_ENABLED } from "../lib/clerk";
import { ClerkSignupForm } from "./auth/ClerkSignupForm";
import { ClerkSessionGuard } from "./auth/ClerkSessionGuard";
import { PasswordSignupForm } from "./auth/PasswordSignupForm";

export default function Signup() {
  const { me } = useAuth();
  const [params] = useSearchParams();
  // Nobody is signed in on this page, so `me` is never the source of truth
  // here: the public config endpoint says whether sign-ups are open.
  const [registrationOpen, setRegistrationOpen] = useState(me?.config.allowRegistration ?? true);
  useEffect(() => {
    let cancelled = false;
    get<{ config: { allowRegistration: boolean } }>("/api/auth/config")
      .then((data) => {
        if (!cancelled) setRegistrationOpen(data.config.allowRegistration);
      })
      .catch(() => {
        /* the form still submits; the server refuses if sign-ups are closed */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const next = afterAuthPath(params.get("next"));
  const loginLink = next === "/app" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      page="signup"
      caption="Start with the plans you have."
      captionSub="Connect an account and every model on it is yours, from chat and from the API."
      eyebrow="Get Started"
      title="Create Your Account"
      subtitle="Connect a provider account next to use its models."
      footer={
        <>
          Already have an account?{" "}
          <Link to={loginLink} className="font-semibold text-accent hover:underline">
            Sign In
          </Link>
        </>
      }
    >
      {CLERK_ENABLED ? (
        <ClerkSessionGuard>
          <ClerkSignupForm registrationOpen={registrationOpen} afterAuth={next} />
        </ClerkSessionGuard>
      ) : (
        <PasswordSignupForm registrationOpen={registrationOpen} afterAuth={next} />
      )}
    </AuthShell>
  );
}
