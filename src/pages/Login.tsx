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
    <div className="honeycomb flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="rise-in">
          <div className="mb-7 flex flex-col items-center gap-4 text-center">
            <Brand dark />
            <p className="max-w-xs text-sm leading-relaxed text-ink-dim">
              Your Google account, <span className="serif-accent text-ink">everywhere</span> — chat with Gemini,
              Claude and GPT-OSS, and let your agents use them too.
            </p>
          </div>

          <form onSubmit={submit} className="glass space-y-4 p-6 sm:p-7">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="mt-1 text-sm text-ink-dim">
                {mode === "login"
                  ? "Your connections, chats and API keys live here."
                  : "Then connect a Google account and start chatting."}
              </p>
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
            {error && <p className="text-sm font-medium text-danger">{error}</p>}
            <Button type="submit" busy={busy} className="w-full" disabled={!email.trim() || !password}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
            <p className="text-center text-sm text-ink-dim">
              {mode === "login" ? "New here? " : "Already have an account? "}
              <button
                type="button"
                className="font-semibold text-accent transition-colors hover:brightness-110"
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
    </div>
  );
}
