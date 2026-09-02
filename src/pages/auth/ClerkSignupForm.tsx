/**
 * Create an account through Clerk, in our own markup.
 *
 * Two steps rather than one: Clerk mails a six-digit code and the account is
 * not real until it comes back. That verification is the point — the backend
 * has never had a way to send mail, so unverified emails were the status quo.
 *
 * The Terms box gates every route out of this card, the social buttons
 * included, which is what makes `terms_accepted_ms` on the row truthful.
 * `legalAccepted` passes the same fact to Clerk so both sides agree.
 */

import { useSignUp } from "@clerk/react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CodeField, ErrorLine, OrRule, SocialButton, TermsCheckbox } from "../../components/auth/AuthBits";
import { Button, Field, Input } from "../../components/ui";
import { SOCIAL_PROVIDERS, SSO_CALLBACK_PATH, clerkMessage } from "../../lib/clerk";
import { useTheme } from "../../lib/theme";
import { useClerkReady } from "./useClerkReady";

type Step = "details" | "code";

export function ClerkSignupForm(props: { registrationOpen: boolean; afterAuth: string }) {
  const { signUp, fetchStatus } = useSignUp();
  const { ready, failed } = useClerkReady();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const working = busy || fetchStatus === "fetching";
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 8 &&
    accepted &&
    !working &&
    ready &&
    props.registrationOpen;

  const finish = async () => {
    const { error: finalizeError } = await signUp.finalize();
    if (finalizeError) {
      setError(clerkMessage(finalizeError));
      return;
    }
    navigate(props.afterAuth, { replace: true });
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signUpError } = await signUp.password({
        emailAddress: email.trim(),
        password,
        legalAccepted: true,
      });
      if (signUpError) {
        setError(clerkMessage(signUpError));
        return;
      }
      if (signUp.status === "complete") {
        await finish();
        return;
      }
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError(clerkMessage(sendError));
        return;
      }
      setStep("code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6 || working) return;
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyError) {
        setError(clerkMessage(verifyError));
        return;
      }
      if (signUp.status === "complete") await finish();
      else setError("That code did not finish the sign-up. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const social = async (strategy: string) => {
    if (!accepted) {
      setError("Please accept the Terms and Privacy Policy first.");
      return;
    }
    setError(null);
    const { error: ssoError } = await signUp.sso({
      strategy: strategy as Parameters<typeof signUp.sso>[0]["strategy"],
      redirectUrl: props.afterAuth,
      redirectCallbackUrl: SSO_CALLBACK_PATH,
      legalAccepted: true,
    });
    if (ssoError) setError(clerkMessage(ssoError));
  };

  if (step === "code") {
    return (
      <form onSubmit={verify} className="auth-stack">
        <p className="text-[13px] leading-relaxed text-ink-dim">
          We sent a six-digit code to <span className="font-medium text-ink">{email.trim()}</span>. Enter
          it to finish setting up your account.
        </p>
        <CodeField value={code} onChange={setCode} onComplete={verify} disabled={working} />
        <ErrorLine>{error}</ErrorLine>
        <Button type="submit" busy={working} className="w-full" disabled={code.length !== 6}>
          Create Account
        </Button>
        <button
          type="button"
          onClick={() => void signUp.verifications.sendEmailCode()}
          className="w-full text-center text-[13px] font-medium text-ink-dim transition-colors hover:text-ink"
        >
          Send the code again
        </button>
      </form>
    );
  }

  return (
    <div className="auth-stack">
      {failed && (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
          Sign-in is temporarily unavailable. Please try again in a few minutes.
        </p>
      )}
      {!props.registrationOpen && (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
          Sign-ups are closed right now. If you already have an account you can{" "}
          <Link to="/login" className="font-medium underline">
            sign in
          </Link>
          .
        </p>
      )}

      <div className="grid gap-2">
        {SOCIAL_PROVIDERS.map((p) => (
          <SocialButton
            key={p.strategy}
            strategy={p.strategy}
            label={`Continue with ${p.label}`}
            onClick={() => void social(p.strategy)}
            disabled={working || !props.registrationOpen || !ready}
          />
        ))}
      </div>

      <OrRule />

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
            autoComplete="new-password"
            onEnter={submit}
            placeholder="At least 8 characters"
          />
        </Field>
        <TermsCheckbox checked={accepted} onChange={setAccepted} />
        {/* Clerk's bot protection (Cloudflare Turnstile) renders itself here.
            It must exist in the DOM *before* signUp.password() runs or the
            attempt is rejected with `captcha_invalid`. Usually it stays
            invisible and this div collapses to nothing; when a challenge is
            actually shown, .auth-main scrolls rather than clipping the card. */}
        <div id="clerk-captcha" data-cl-theme={theme} data-cl-size="flexible" className="empty:hidden" />
        <ErrorLine>{error}</ErrorLine>
        <Button type="submit" busy={working} className="w-full" disabled={!canSubmit}>
          Create Account
        </Button>
      </form>
    </div>
  );
}
