import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type Me } from "../App";
import { AuthShell } from "../components/auth/AuthShell";
import { Button, Field, Input } from "../components/ui";
import { friendly, post } from "../lib/api";

export default function Login() {
  const { setMe } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("connect_error"));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    post<Me>("/api/auth/login", { email: email.trim(), password })
      .then((me) => {
        setMe(me);
        navigate("/app", { replace: true });
      })
      .catch((err) => setError(friendly(err)))
      .finally(() => setBusy(false));
  };

  return (
    <AuthShell
      side="right"
      caption="Every model on your plan, one login."
      captionSub="Your Google accounts, chats and API keys are where you left them."
      eyebrow="Welcome Back"
      title="Sign In to Ohshi"
      subtitle="Use the email and password you signed up with."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-semibold text-accent hover:underline">
            Create an Account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
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
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" busy={busy} className="w-full" disabled={!email.trim() || !password}>
          Sign In
        </Button>
      </form>
    </AuthShell>
  );
}
