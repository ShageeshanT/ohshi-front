import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, type Me } from "../App";
import { AuthShell } from "../components/auth/AuthShell";
import { Button, Field, Input } from "../components/ui";
import { friendly, post } from "../lib/api";

export default function Signup() {
  const { me, setMe } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registrationOpen = me?.config.allowRegistration ?? true;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = email.trim().length > 0 && password.length >= 8 && confirm === password && accepted && !busy;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    post<Me>("/api/auth/register", { email: email.trim(), password, acceptTerms: true })
      .then((next) => {
        setMe(next);
        navigate("/app", { replace: true });
      })
      .catch((err) => setError(friendly(err)))
      .finally(() => setBusy(false));
  };

  return (
    <AuthShell
      side="left"
      caption="Start with the plan you have."
      captionSub="Connect a Google account and every model on it is yours, from chat and from the API."
      eyebrow="Get Started"
      title="Create Your Account"
      subtitle="Connect a Google account next to use its models."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign In
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="auth-stack">
        {!registrationOpen && (
          <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
            Sign ups are closed at the moment. If you already have an account,{" "}
            <Link to="/login" className="font-semibold underline underline-offset-2">
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

        <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-edge bg-panel-2/60 px-3.5 py-[clamp(0.5rem,1.6vh,0.875rem)] text-[13px] leading-snug">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink/25 bg-panel transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40"
          >
            <Check className={`h-3.5 w-3.5 text-accent-ink transition-opacity ${accepted ? "opacity-100" : "opacity-0"}`} />
          </span>
          <span className="text-ink/85">
            I agree to the{" "}
            <Link to="/terms" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
              Terms and Conditions
            </Link>{" "}
            and the{" "}
            <Link to="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
              Privacy Policy
            </Link>
            , and that usage runs on the Google account I connect.
          </span>
        </label>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" busy={busy} className="w-full" disabled={!canSubmit || !registrationOpen}>
          Create Account
        </Button>
      </form>
    </AuthShell>
  );
}
