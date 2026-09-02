/**
 * Create an account against our own `/api/auth/register` — the original
 * engine, used whenever `VITE_CLERK_PUBLISHABLE_KEY` is not set.
 */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, type Me } from "../../App";
import { ErrorLine, TermsCheckbox } from "../../components/auth/AuthBits";
import { Button, Field, Input } from "../../components/ui";
import { friendly, post } from "../../lib/api";
import { buildMismatch } from "../../lib/clerk";

export function PasswordSignupForm(props: { registrationOpen: boolean; afterAuth: string }) {
  const { setMe } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    email.trim().length > 0 && password.length >= 8 && confirm === password && accepted && !busy;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    post<Me>("/api/auth/register", { email: email.trim(), password, acceptTerms: true })
      .then((me) => {
        setMe(me);
        navigate(props.afterAuth, { replace: true });
      })
      .catch((err) => setError(buildMismatch(err) ?? friendly(err)))
      .finally(() => setBusy(false));
  };

  return (
    <form onSubmit={submit} className="auth-stack">
      {!props.registrationOpen && (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
          Sign-ups are closed right now. If you already have an account you can{" "}
          <Link to="/login" className="font-medium underline">
            sign in
          </Link>
          .
        </p>
      )}
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </Field>
      <Field label="Confirm Password" hint={mismatch ? "Passwords don't match yet." : undefined}>
        <Input
          value={confirm}
          onChange={setConfirm}
          type="password"
          autoComplete="new-password"
          onEnter={submit}
          placeholder="••••••••••"
        />
      </Field>
      <TermsCheckbox checked={accepted} onChange={setAccepted} />
      <ErrorLine>{error}</ErrorLine>
      <Button
        type="submit"
        busy={busy}
        className="w-full"
        disabled={!canSubmit || !props.registrationOpen}
      >
        Create Account
      </Button>
    </form>
  );
}
