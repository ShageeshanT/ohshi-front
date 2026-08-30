/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Clerk's publishable key (`pk_test_…` / `pk_live_…`). Unset means the app
   * keeps its own email + password sign-in — see lib/clerk.ts.
   */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
