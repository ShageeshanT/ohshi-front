/**
 * Connect DeepSeek chat — email and password for the account at
 * chat.deepseek.com. There is no OAuth; the backend posts those to DeepSeek
 * and keeps the session JWT (and the password, encrypted) so it can re-login
 * when the token expires.
 */

import { useState } from "react";
import { ApiError, friendly, post } from "../lib/api";
import { DeepSeekLogo } from "./logos";
import { Button, Field, Input, Modal } from "./ui";

interface ConnectResponse {
  ok: boolean;
  error?: string;
  connection?: { email: string };
}

export default function ConnectDeepSeekModal(props: {
  open: boolean;
  onClose: () => void;
  onDone: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setPassword("");
    setNote(null);
    setBusy(false);
  };

  const submit = () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    post<ConnectResponse>("/api/deepseek/connect", { email, password })
      .then((body) => {
        if (!body.ok || !body.connection) {
          setNote(body.error || "DeepSeek refused this sign-in.");
          return;
        }
        props.onDone(body.connection.email);
        reset();
      })
      .catch((e) => {
        setNote(e instanceof ApiError ? e.message : friendly(e));
      })
      .finally(() => setBusy(false));
  };

  return (
    <Modal
      open={props.open}
      onClose={() => {
        if (!busy) {
          reset();
          props.onClose();
        }
      }}
      title={
        <span className="inline-flex items-center gap-2">
          <DeepSeekLogo className="h-4 w-4" /> Connect DeepSeek
        </span>
      }
    >
      <p className="text-[13px] leading-5 text-ink-dim">
        Sign in with the email and password of your DeepSeek chat account. Ohshi
        stores them encrypted so it can refresh the session; they never go to
        the browser after you submit.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Email">
          <Input
            type="email"
            autoComplete="username"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            placeholder="DeepSeek password"
          />
        </Field>
        {note && <p className="text-[12.5px] text-danger">{note}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            tone="ghost"
            disabled={busy}
            onClick={() => {
              reset();
              props.onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={!email.trim() || password.length < 6}>
            Sign in
          </Button>
        </div>
      </form>
    </Modal>
  );
}
