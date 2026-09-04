/**
 * What the account actually signs in with, in the user's words: Google or an
 * email address. "Clerk" is our auth vendor, not a thing anyone chose, so it
 * never appears here.
 *
 * With Clerk on, only the browser knows which strategy was used — the session
 * token carries no such claim and the backend has no Clerk secret key in
 * production — so the answer comes from Clerk's own user object. The hook may
 * only be called inside ClerkProvider, which `main.tsx` mounts only when a
 * publishable key was built in; hence the two components.
 */

import { useUser } from "@clerk/react";
import { Badge } from "./ui";
import { CLERK_ENABLED } from "../lib/clerk";

function ClerkMethod() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <Badge tone="dim">…</Badge>;
  const google = user?.externalAccounts?.some((a) => (a.provider ?? "").includes("google"));
  if (google) {
    const account = user?.externalAccounts?.find((a) => (a.provider ?? "").includes("google"));
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge>Google</Badge>
        {account?.emailAddress && <span className="text-[12px] text-ink-dim">{account.emailAddress}</span>}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge>Email</Badge>
      <span className="text-[12px] text-ink-dim">
        {user?.passwordEnabled ? "with a password" : "with a one-time code"}
      </span>
    </span>
  );
}

export function SignInMethod(props: { clerk: boolean }) {
  if (props.clerk && CLERK_ENABLED) return <ClerkMethod />;
  return <Badge>Email</Badge>;
}
