/**
 * Sign in against our own `/api/auth/login` — the original engine, used
 * whenever `VITE_CLERK_PUBLISHABLE_KEY` is not set. Delete this file (and its
 * sign-up twin) once Clerk has been live long enough that no deployment runs
 * without it.
 */

import { useState, type FormEvent } from "react";
import { ErrorLine } from "../../components/auth/AuthBits";
import { Button, Field, Input } from "../../components/ui";
import { useAuth, type Me } from "../../App";
import { friendly, post } from "../../lib/api";
import { buildMismatch } from "../../lib/clerk";
import { useNavigate } from "react-router-dom";

export function PasswordLoginForm(props: { initialError?: string | null; afterAuth: string }) {
  const { setMe } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(props.initialError ?? null);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    post<Me>("/api/auth/login", { email: email.trim(), password })
      .then((me) => {
        setMe(me);
        navigate(props.afterAuth, { replace: true });
      })
      .catch((err) => setError(buildMismatch(err) ?? friendly(err)))
      .finally(() => setBusy(false));
  };

  return (
    <form onSubmit={submit} className="auth-stack">
      <Field label="Email">
        <Input
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
        />
      </Field>
      <Field label="Password">
        <Input
          value={password}
          onChange={setPassword}
          type="password"
          autoComplete="current-password"
          onEnter={submit}
          placeholder="••••••••••"
        />
      </Field>
      <ErrorLine>{error}</ErrorLine>
      <Button type="submit" busy={busy} className="w-full" disabled={!email.trim() || !password}>
        Sign In
      </Button>
    </form>
  );
}
