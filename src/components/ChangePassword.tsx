/**
 * Change password, on whichever engine holds the credential.
 *
 *   • Password accounts: prove the current password, set a new one through
 *     POST /api/auth/password. Every other device is signed out.
 *   • Clerk accounts: a one-time code goes to the account's email first
 *     (Clerk's session verification), then the new password is set through
 *     Clerk with `signOutOfOtherSessions`. An account that signed up through
 *     Google and never set a password gets one the same way.
 *
 * `CLERK_ENABLED` is a build-time constant, so the two branches are separate
 * components and no hook order ever changes.
 */

import { useSession, useUser } from "@clerk/react";
import { Check, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { friendly, post } from "../lib/api";
import { CLERK_ENABLED, clerkMessage } from "../lib/clerk";
import { CodeField } from "./auth/AuthBits";
import { Button, Field, Input } from "./ui";

export function ChangePassword() {
  return CLERK_ENABLED ? <ClerkPasswordChange /> : <LocalPasswordChange />;
}

const MIN = 8;

function NewPasswordFields(props: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
}) {
  const mismatch = props.confirm.length > 0 && props.confirm !== props.password;
  return (
    <>
      <Field label="New password">
        <Input
          value={props.password}
          onChange={props.onPassword}
          type="password"
          autoComplete="new-password"
          placeholder={`At least ${MIN} characters`}
        />
      </Field>
      <Field label="Confirm new password" hint={mismatch ? "Passwords don't match yet." : undefined}>
        <Input value={props.confirm} onChange={props.onConfirm} type="password" autoComplete="new-password" placeholder="••••••••••" />
      </Field>
    </>
  );
}

// --- our own engine ------------------------------------------------------------------

function LocalPasswordChange() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = current.length > 0 && password.length >= MIN && confirm === password && !busy;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    post("/api/auth/password", { currentPassword: current, newPassword: password })
      .then(() => {
        setDone(true);
        setOpen(false);
        setCurrent("");
        setPassword("");
        setConfirm("");
      })
      .catch((err) => setError(friendly(err)))
      .finally(() => setBusy(false));
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button tone="ghost" onClick={() => setOpen(true)}>
          <KeyRound className="h-3.5 w-3.5" /> Change password
        </Button>
        {done && (
          <span className="inline-flex items-center gap-1 text-[12.5px] text-ok">
            <Check className="h-3.5 w-3.5" /> Password changed. Other devices were signed out.
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-3">
      <Field label="Current password">
        <Input value={current} onChange={setCurrent} type="password" autoComplete="current-password" autoFocus placeholder="••••••••••" />
      </Field>
      <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" busy={busy} disabled={!canSubmit}>
          Save new password
        </Button>
        <Button tone="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <p className="text-[12px] text-ink-dim">Every other browser signed in to this account is signed out.</p>
    </form>
  );
}

// --- Clerk: email code, then the new password --------------------------------------------

type Step = "idle" | "sending" | "code" | "password" | "done";

function ClerkPasswordChange() {
  const { session } = useSession();
  const { user } = useUser();
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPassword = user?.passwordEnabled ?? false;
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const reset = () => {
    setStep("idle");
    setCode("");
    setCurrent("");
    setPassword("");
    setConfirm("");
    setError(null);
  };

  /** Ask Clerk for a first-factor check and mail the code. */
  const start = async () => {
    if (!session) return;
    setStep("sending");
    setError(null);
    try {
      const verification = await session.startVerification({ level: "first_factor" });
      const factor = verification.supportedFirstFactors?.find((f) => f.strategy === "email_code");
      if (!factor || factor.strategy !== "email_code") {
        // No email code on this account: fall through to the password form,
        // where Clerk still requires the current password.
        setStep("password");
        return;
      }
      await session.prepareFirstFactorVerification({ strategy: "email_code", emailAddressId: factor.emailAddressId });
      setStep("code");
    } catch (err) {
      setError(clerkMessage(err));
      setStep("idle");
    }
  };

  const verify = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!session || code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await session.attemptFirstFactorVerification({ strategy: "email_code", code });
      if (result.status === "complete") setStep("password");
      else setError("That code did not verify. Check it and try again.");
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const canSave = password.length >= MIN && confirm === password && (!hasPassword || current.length > 0) && !busy;

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!user || !canSave) return;
    setBusy(true);
    setError(null);
    try {
      await user.updatePassword({
        newPassword: password,
        signOutOfOtherSessions: true,
        ...(hasPassword ? { currentPassword: current } : {}),
      });
      setStep("done");
      setCode("");
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === "idle" || step === "sending" || step === "done") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button tone="ghost" busy={step === "sending"} onClick={() => void start()} disabled={!session || !user}>
          <KeyRound className="h-3.5 w-3.5" /> {hasPassword ? "Change password" : "Set a password"}
        </Button>
        {step === "done" && (
          <span className="inline-flex items-center gap-1 text-[12.5px] text-ok">
            <Check className="h-3.5 w-3.5" /> Password {hasPassword ? "changed" : "set"}. Other devices were signed out.
          </span>
        )}
        {step === "idle" && !error && (
          <span className="text-[12px] text-ink-dim">We email a one-time code first.</span>
        )}
        {error && <span className="text-[12.5px] text-danger">{error}</span>}
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="w-full max-w-sm space-y-3">
        <p className="text-[12.5px] leading-relaxed text-ink-dim">
          We sent a six-digit code to <span className="font-medium text-ink">{email}</span>. Enter it to continue.
        </p>
        <CodeField value={code} onChange={setCode} onComplete={verify} disabled={busy} />
        {error && <p className="text-[12.5px] text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" busy={busy} disabled={code.length !== 6}>
            Verify code
          </Button>
          <Button tone="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={save} className="w-full max-w-sm space-y-3">
      <p className="inline-flex items-center gap-1 text-[12.5px] text-ok">
        <Check className="h-3.5 w-3.5" /> Verified. Now choose the new password.
      </p>
      {hasPassword && (
        <Field label="Current password">
          <Input value={current} onChange={setCurrent} type="password" autoComplete="current-password" autoFocus placeholder="••••••••••" />
        </Field>
      )}
      <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
      {error && <p className="text-[12.5px] text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" busy={busy} disabled={!canSave}>
          Save new password
        </Button>
        <Button tone="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
      <p className="text-[12px] text-ink-dim">Every other browser signed in to this account is signed out.</p>
    </form>
  );
}
