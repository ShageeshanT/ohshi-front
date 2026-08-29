import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth, type Me } from "../App";
import { Brand } from "../components/brand";
import { Button, Field, Input } from "../components/ui";
import { friendly, post } from "../lib/api";

export default function Login() {
  const { setMe } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("connect_error"));

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    post<Me>(`/api/auth/${mode}`, { email: email.trim(), password })
      .then((me) => setMe(me))
      .catch((err) => setError(friendly(err)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="rise-in w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Brand dark />
        </div>
        <form onSubmit={submit} className="panel space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h1>
            <p className="mt-1 text-sm text-ink-dim">
              {mode === "login"
                ? "Your Google connections and API keys live here."
                : "Then connect a Google account and mint an API key for your agents."}
            </p>
          </div>
          <Field label="Email">
            <Input value={email} onChange={setEmail} type="email" autoComplete="email" autoFocus placeholder="you@example.com" />
          </Field>
          <Field label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}>
            <Input
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onEnter={submit}
              placeholder="••••••••••"
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" busy={busy} className="w-full" disabled={!email.trim() || !password}>
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
          <p className="text-center text-sm text-ink-dim">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              className="font-semibold text-accent hover:underline"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
