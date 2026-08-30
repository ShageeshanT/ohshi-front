/**
 * Has Clerk's script actually arrived?
 *
 * The SDK renders nothing and throws nothing while it waits, so a form built
 * on its hooks would otherwise sit there looking usable and then fail on
 * submit — or, worse, an app gated on `isLoaded` would show a spinner for
 * ever. Two signals, because they cover different failures:
 *
 * - `status` is the SDK's own word: 'loading' until the script runs, 'ready'
 *   after, 'error' when the request came back and failed.
 * - the timer covers the request that never comes back at all, which is what
 *   a DNS record that has not reached the visitor's resolver looks like from
 *   inside the browser: not an error, just silence.
 */

import { useClerk } from "@clerk/react";
import { useEffect, useState } from "react";

/** Generous for a cold cache on a slow link; short enough to feel like a decision. */
export const CLERK_LOAD_TIMEOUT_MS = 8000;

export interface ClerkReadiness {
  /** The script has run and the SDK is usable. */
  ready: boolean;
  /** It is not coming: the SDK said so, or the timer ran out first. */
  failed: boolean;
}

export function useClerkReady(): ClerkReadiness {
  const clerk = useClerk();
  const loaded = Boolean(clerk?.loaded);
  const status = clerk?.status;
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => setTimedOut(true), CLERK_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  const errored = status === "error";
  return {
    ready: loaded && !errored,
    failed: errored || (timedOut && !loaded),
  };
}
