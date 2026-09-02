/**
 * Connect Google — start (PKCE) → open Google sign-in → paste the code → finish.
 * In "callback" mode (own OAuth client) the browser is simply sent to Google
 * and comes back to /?connected=… via /api/google/callback.
 */

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { friendly, post } from "../lib/api";
import { Button, Field, Input, Modal } from "./ui";

interface StartResponse {
  authorizeUrl: string;
  state: string;
  redirectMode: "paste" | "callback";
}

interface ExchangeResponse {
  ok: boolean;
  error?: string;
  connection?: { email: string };
}

export default function ConnectGoogleModal(props: {
  open: boolean;
  onClose: () => void;
  onDone: (email: string) => void;
}) {
  const [start, setStart] = useState<StartResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [code, setCode] = useState("");
  const [exchanging, setExchanging] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const reset = () => {
    setStart(null);
    setCode("");
    setNote(null);
  };

  const begin = () => {
    setStarting(true);
    setNote(null);
    post<StartResponse>("/api/google/connect/start")
      .then((d) => {
        if (d.redirectMode === "callback") {
          window.location.assign(d.authorizeUrl);
          return;
        }
        setStart(d);
        window.open(d.authorizeUrl, "_blank", "noopener");
      })
      .catch((e) => setNote(friendly(e, "Couldn't start the sign in. Please try again.")))
      .finally(() => setStarting(false));
  };

  const finish = () => {
    const c = code.trim();
    if (!c) return;
    setExchanging(true);
    setNote(null);
    post<ExchangeResponse>("/api/google/connect/exchange", { code: c })
      .then((d) => {
        if (d.ok && d.connection) {
          reset();
          props.onDone(d.connection.email);
        } else {
          setNote(d.error || "That code didn't work. Copy it again and retry.");
        }
      })
      .catch((e) => setNote(friendly(e, "That code didn't work. Copy it again and retry.")))
      .finally(() => setExchanging(false));
  };

  return (
    <Modal
      open={props.open}
      onClose={() => {
        reset();
        props.onClose();
      }}
      title="Connect a Google account (Beta)"
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-dim">
          Sign in with the Google account whose plan you want to use (Google AI Pro / Ultra
          unlocks the full model list). Google shows a code at the end. Paste it below and
          your agents can use Gemini, Claude and GPT-OSS on that account. This connector is in
          Beta; a Gemini API key is the supported path.
        </p>

        {!start ? (
          <Button onClick={begin} busy={starting}>
            <ExternalLink className="h-4 w-4" /> Sign in with Google
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-panel-2 px-3.5 py-3 text-xs text-ink-dim">
              A Google sign in tab was opened.{" "}
              <button
                type="button"
                className="font-semibold text-accent underline-offset-2 hover:underline"
                onClick={() => window.open(start.authorizeUrl, "_blank", "noopener")}
              >
                Open it again
              </button>{" "}
              if nothing appeared.
            </div>
            <Field
              label="Your code"
              hint="After signing in, Google shows a code, or lands on a page whose address holds it. Paste either here."
            >
              <Input
                value={code}
                onChange={setCode}
                placeholder="Paste the code or the whole address from Google"
                onEnter={finish}
                autoFocus
                mono
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={finish} busy={exchanging} disabled={!code.trim()}>
                Finish connecting
              </Button>
              <Button tone="ghost" onClick={reset}>
                Start over
              </Button>
            </div>
          </div>
        )}

        {note && <p className="text-sm text-warn">{note}</p>}
      </div>
    </Modal>
  );
}
