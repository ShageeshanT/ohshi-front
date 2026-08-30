/**
 * Sits between the auth pages and the Clerk forms for the one state the forms
 * cannot express: Clerk holds a session but our API refused it. Left alone,
 * every submit just bounces off Clerk's "You're already signed in." — a dead
 * end that names neither the problem nor a way out.
 *
 * So: while the session is still being checked, hold quietly (the route will
 * move to /app on its own the moment the API says yes). Once the API has said
 * no, show its exact words and offer the only move that helps — signing the
 * Clerk session out so the visitor can start over.
 */

import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { useState, type ReactNode } from "react";
import { useAuth } from "../../App";
import { Button, Spinner } from "../../components/ui";

export function ClerkSessionGuard(props: { children: ReactNode }) {
  const { isSignedIn } = useClerkAuth();
  const clerk = useClerk();
  const { authError } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!isSignedIn) return props.children;

  if (!authError) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-ink-dim">
        <Spinner />
        Checking your session…
      </div>
    );
  }

  return (
    <div className="auth-stack">
      <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
        You are signed in, but the server did not accept the session:{" "}
        <span className="font-semibold">{authError}</span>
      </p>
      <Button
        className="w-full"
        busy={busy}
        onClick={() => {
          setBusy(true);
          void clerk.signOut().finally(() => setBusy(false));
        }}
      >
        Sign Out and Try Again
      </Button>
    </div>
  );
}
