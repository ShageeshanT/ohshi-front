import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type Me } from "../App";
import { TilesBackdrop } from "../components/marketing/Backdrop";
import { MarketingNav } from "../components/marketing/MarketingNav";
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
    <div className="relative min-h-screen">
      <TilesBackdrop />
      <MarketingNav minimal />
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 pb-16 pt-28">
        <form onSubmit={submit} className="glass rise-in w-full max-w-md space-y-5 p-7 sm:p-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Welcome back</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Sign in to Ohshi</h1>
            <p className="mt-1.5 text-sm text-ink-dim">Your Google connections, chats and API keys live here.</p>
          </div>
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
            Sign in
          </Button>
          <p className="text-center text-sm text-ink-dim">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-accent hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
