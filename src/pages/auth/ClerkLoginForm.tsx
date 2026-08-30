/**
 * Sign in through Clerk, in our own markup.
 *
 * Clerk's `<SignIn />` component is deliberately not used: it would replace the
 * whole card. `useSignIn()` is the headless equivalent, so the fields, the pill
 * buttons and the one-screen layout stay exactly as they were and only the
 * plumbing behind the submit handler changes.
 *
 * Three ways in, all on the same card: a social provider, an email and
 * password, or a six-digit code mailed from ohshi.space.
 */

import { useSignIn } from "@clerk/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CodeField, ErrorLine, OrRule, SocialButton } from "../../components/auth/AuthBits";
import { Button, Field, Input } from "../../components/ui";
import { AFTER_AUTH_PATH, SOCIAL_PROVIDERS, SSO_CALLBACK_PATH, clerkMessage } from "../../lib/clerk";

type Step = "credentials" | "code";

export function ClerkLoginForm(props: { initialError?: string | null }) {
  const { signIn, fetchStatus } = useSignIn();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("credentials");
  const [usePassword, setUsePassword] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(props.initialError ?? null);
  const [busy, setBusy] = useState(false);

  const working = busy || fetchStatus === "fetching";

  /** Clerk says the attempt is complete — turn it into a session and move on. */
  const finish = async () => {
    const { error: finalizeError } = await signIn.finalize();
    if (finalizeError) {
      setError(clerkMessage(finalizeError));
      return;
    }
    navigate(AFTER_AUTH_PATH, { replace: true });
  };

  const submitPassword = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !password || working) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await signIn.password({
        identifier: email.trim(),
        password,
      });
      if (signInError) {
        setError(clerkMessage(signInError));
        return;
      }
      if (signIn.status === "complete") await finish();
      else setError("This account needs another step to sign in. Check your email.");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || working) return;
    setBusy(true);
    setError(null);
    try {
      const { error: createError } = await signIn.create({ identifier: email.trim() });
      if (createError) {
        setError(clerkMessage(createError));
        return;
      }
      const { error: sendError } = await signIn.emailCode.sendCode();
      if (sendError) {
        setError(clerkMessage(sendError));
        return;
      }
      setStep("code");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6 || working) return;
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await signIn.emailCode.verifyCode({ code });
      if (verifyError) {
        setError(clerkMessage(verifyError));
        return;
      }
      if (signIn.status === "complete") await finish();
      else setError("That code did not complete the sign-in. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const social = async (strategy: string) => {
    setError(null);
    const { error: ssoError } = await signIn.sso({
      strategy: strategy as Parameters<typeof signIn.sso>[0]["strategy"],
      redirectUrl: AFTER_AUTH_PATH,
      redirectCallbackUrl: SSO_CALLBACK_PATH,
    });
    if (ssoError) setError(clerkMessage(ssoError));
  };

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="auth-stack">
        <p className="text-[13px] leading-snug text-ink-dim">
          We sent a six-digit code to <span className="font-semibold text-ink">{email.trim()}</span>.
        </p>
        <CodeField value={code} onChange={setCode} onComplete={verifyCode} disabled={working} />
        <ErrorLine>{error}</ErrorLine>
        <Button type="submit" busy={working} className="w-full" disabled={code.length !== 6}>
          Sign In
        </Button>
        <button
          type="button"
          onClick={() => {
            setStep("credentials");
            setCode("");
            setError(null);
          }}
          className="w-full text-center text-[13px] font-medium text-ink-dim transition-colors hover:text-ink"
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <div className="auth-stack">
      <div className="grid gap-2">
        {SOCIAL_PROVIDERS.map((p) => (
          <SocialButton
            key={p.strategy}
            strategy={p.strategy}
            label={`Continue with ${p.label}`}
            onClick={() => void social(p.strategy)}
            disabled={working}
          />
        ))}
      </div>

      <OrRule />

      <form onSubmit={usePassword ? submitPassword : sendCode} className="auth-stack">
        <Field label="Email">
          <Input
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            onEnter={usePassword ? undefined : sendCode}
          />
        </Field>
        {usePassword && (
          <Field label="Password">
            <Input
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="current-password"
              onEnter={submitPassword}
              placeholder="••••••••••"
            />
          </Field>
        )}
        <ErrorLine>{error}</ErrorLine>
        <Button
          type="submit"
          busy={working}
          className="w-full"
          disabled={!email.trim() || (usePassword && !password)}
        >
          {usePassword ? "Sign In" : "Email Me a Code"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setUsePassword((v) => !v);
          setError(null);
        }}
        className="w-full text-center text-[13px] font-medium text-ink-dim transition-colors hover:text-ink"
      >
        {usePassword ? "Email me a code instead" : "Use a password instead"}
      </button>
    </div>
  );
}
