/**
 * Connect ChatGPT — the Codex CLI's sign-in, two ways:
 *
 * - **Code** (default): POST /api/openai/connect/start {mode: "device"} hands
 *   back a short code; the person enters it at auth.openai.com/codex/device
 *   and this dialog polls /api/openai/connect/poll until OpenAI says done.
 * - **Paste**: the browser flow. OpenAI sends the browser to localhost:1455
 *   (nothing answers there); the person copies that address back.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Link2 } from "lucide-react";
import { ApiError, copyText, friendly, post, safeExternalUrl } from "../lib/api";
import { OpenAILogo } from "./logos";
import { Button, Field, Input, Modal, Spinner, Tabs } from "./ui";

interface DeviceStart {
  mode: "device";
  state: string;
  userCode: string;
  verifyUrl: string;
  intervalS: number;
  expiresMs: number;
}

interface PasteStart {
  mode: "paste";
  state: string;
  authorizeUrl: string;
  expiresMs: number;
}

interface PollResponse {
  ok: boolean;
  status: "pending" | "done";
  connection?: { email: string };
  error?: string;
}

interface ExchangeResponse {
  ok: boolean;
  error?: string;
  connection?: { email: string };
}

const MODES = ["Enter a code", "Paste the address"];

export default function ConnectChatGPTModal(props: {
  open: boolean;
  onClose: () => void;
  onDone: (email: string) => void;
}) {
  const [mode, setMode] = useState(MODES[0]);
  const [device, setDevice] = useState<DeviceStart | null>(null);
  const [paste, setPaste] = useState<PasteStart | null>(null);
  const [starting, setStarting] = useState(false);
  const [code, setCode] = useState("");
  const [exchanging, setExchanging] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const onDoneRef = useRef(props.onDone);
  onDoneRef.current = props.onDone;

  const stopPolling = () => {
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const reset = () => {
    stopPolling();
    setDevice(null);
    setPaste(null);
    setCode("");
    setNote(null);
    setCopied(false);
  };

  useEffect(() => {
    if (!props.open) reset();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  // Poll while a device sign-in is pending. One request per interval; the
  // server asks OpenAI no more often than that whatever we do.
  useEffect(() => {
    if (!device) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const d = await post<PollResponse>("/api/openai/connect/poll", { state: device.state });
        if (cancelled) return;
        if (d.status === "done" && d.connection) {
          setDevice(null);
          onDoneRef.current(d.connection.email);
          return;
        }
        if (Date.now() > device.expiresMs) {
          setNote("This code expired. Get a new one.");
          setDevice(null);
          return;
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 410 || e.status === 400 || e.status === 502)) {
          setNote(friendly(e, "That sign-in did not finish. Get a new code."));
          setDevice(null);
          return;
        }
        // A blip: keep polling.
      }
      pollTimer.current = window.setTimeout(() => void tick(), Math.max(2, device.intervalS) * 1000);
    };
    pollTimer.current = window.setTimeout(() => void tick(), Math.max(2, device.intervalS) * 1000);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [device]);

  const beginDevice = () => {
    setStarting(true);
    setNote(null);
    post<DeviceStart>("/api/openai/connect/start", { mode: "device" })
      .then((d) => {
        // The code is what matters; the page is only opened when the address
        // is the real https one (never a javascript: or look-alike scheme).
        const verifyUrl = safeExternalUrl(d.verifyUrl, ["auth.openai.com"]) ?? "";
        setDevice({ ...d, verifyUrl });
        if (verifyUrl) window.open(verifyUrl, "_blank", "noopener");
      })
      .catch((e) => setNote(friendly(e, "Couldn't start the sign in. Please try again.")))
      .finally(() => setStarting(false));
  };

  const beginPaste = () => {
    setStarting(true);
    setNote(null);
    post<PasteStart>("/api/openai/connect/start", { mode: "paste" })
      .then((d) => {
        const authorizeUrl = safeExternalUrl(d.authorizeUrl, ["auth.openai.com"]);
        if (!authorizeUrl) throw new Error("unexpected sign-in address");
        setPaste({ ...d, authorizeUrl });
        window.open(authorizeUrl, "_blank", "noopener");
      })
      .catch((e) => setNote(friendly(e, "Couldn't start the sign in. Please try again.")))
      .finally(() => setStarting(false));
  };

  const finishPaste = () => {
    const c = code.trim();
    if (!c) return;
    setExchanging(true);
    setNote(null);
    post<ExchangeResponse>("/api/openai/connect/exchange", { code: c })
      .then((d) => {
        if (d.ok && d.connection) {
          reset();
          props.onDone(d.connection.email);
        } else {
          setNote(d.error || "That didn't work. Copy the address again and retry.");
        }
      })
      .catch((e) => setNote(friendly(e, "That didn't work. Copy the address again and retry.")))
      .finally(() => setExchanging(false));
  };

  const copyCode = () => {
    if (!device) return;
    void copyText(device.userCode).then((ok) => {
      setCopied(ok);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  const changeMode = (next: string) => {
    reset();
    setMode(next);
  };

  return (
    <Modal
      open={props.open}
      onClose={() => {
        reset();
        props.onClose();
      }}
      title="Connect a ChatGPT account"
    >
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-ink-dim">
          Sign in with the ChatGPT account behind your Plus, Pro or Team plan. Ohshi uses the same sign-in the
          Codex CLI does, so your agents and this chat run on that plan. In Beta; a Gemini API key is the
          supported path for anything that must not break.
        </p>

        <Tabs tabs={MODES} active={mode} onChange={changeMode} />

        {mode === MODES[0] ? (
          !device ? (
            <Button tone="ghost" onClick={beginDevice} busy={starting}>
              <OpenAILogo className="h-3.5 w-3.5" /> Get a sign-in code <ExternalLink className="h-3.5 w-3.5 text-ink-dim" />
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-edge bg-panel-2 p-3.5">
                <p className="text-[12px] text-ink-dim">
                  Enter this code at <span className="mono text-ink">auth.openai.com/codex/device</span>
                  {device.verifyUrl ? " (the page that just opened)" : ""}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="mono select-all text-[22px] font-semibold tracking-[0.18em] text-ink">{device.userCode}</code>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-ink/[0.06] hover:text-ink"
                    aria-label="Copy code"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {device.verifyUrl && (
                  <p className="mt-2 text-[12px] text-ink-dim">
                    Nothing opened?{" "}
                    <button
                      type="button"
                      className="font-medium text-accent underline-offset-2 hover:underline"
                      onClick={() => window.open(device.verifyUrl, "_blank", "noopener")}
                    >
                      Open auth.openai.com/codex/device
                    </button>
                  </p>
                )}
              </div>
              <p className="flex items-center gap-2 text-[12.5px] text-ink-dim">
                <Spinner size={12} /> Waiting for you to finish signing in at OpenAI…
              </p>
              <Button tone="ghost" size="sm" onClick={reset}>
                Start over
              </Button>
            </div>
          )
        ) : !paste ? (
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-ink-dim">
              OpenAI will send your browser to <span className="mono">localhost:1455</span>, a page that only a
              running Codex CLI would answer. It will look broken; that is expected. Copy the whole address from
              the address bar and paste it below.
            </p>
            <Button tone="ghost" onClick={beginPaste} busy={starting}>
              <Link2 className="h-3.5 w-3.5" /> Sign in with OpenAI <ExternalLink className="h-3.5 w-3.5 text-ink-dim" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-panel-2 px-3 py-2.5 text-[12.5px] text-ink-dim">
              An OpenAI sign in tab was opened.{" "}
              <button
                type="button"
                className="font-medium text-accent underline-offset-2 hover:underline"
                onClick={() => window.open(paste.authorizeUrl, "_blank", "noopener")}
              >
                Open it again
              </button>{" "}
              if nothing appeared.
            </div>
            <Field
              label="The address you landed on"
              hint="It starts with http://localhost:1455/auth/callback?code=… — the whole thing, or just the code."
            >
              <Input
                value={code}
                onChange={setCode}
                placeholder="http://localhost:1455/auth/callback?code=…&state=…"
                onEnter={finishPaste}
                autoFocus
                mono
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={finishPaste} busy={exchanging} disabled={!code.trim()}>
                <KeyRound className="h-3.5 w-3.5" /> Finish connecting
              </Button>
              <Button tone="ghost" onClick={reset}>
                Start over
              </Button>
            </div>
          </div>
        )}

        {note && <p className="text-[13px] text-warn">{note}</p>}
      </div>
    </Modal>
  );
}
