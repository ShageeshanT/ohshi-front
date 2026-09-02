/**
 * Connector (Beta) — run an account's model calls from your own computer.
 *
 * Data:
 *   GET  /api/runner                    -> RunnerStatus (tokens, online, hostname, lastSeenMs, …)
 *   POST /api/runner/tokens {name}      -> {token, runnerToken}   (the token is shown once)
 *   POST /api/runner/tokens/:id/revoke  -> {ok}
 *
 * The per-account switch ("Run on my machine") lives on each connection card;
 * this card is the connector itself: status, tokens and the one-liner to run.
 */

import { useState } from "react";
import { Check, Copy, Laptop, Plus, Trash2 } from "lucide-react";
import { copyText, friendly, post, timeAgo } from "../lib/api";
import { Badge, Button, Card, Code, Field, Input, Modal, Notice } from "./ui";

export interface RunnerTokenRow {
  id: string;
  name: string;
  prefix: string;
  createdMs: number;
  lastSeenMs: number | null;
  revokedMs: number | null;
}

export interface RunnerStatus {
  tokens: RunnerTokenRow[];
  online: boolean;
  hostname: string | null;
  lastSeenMs: number | null;
  version: string | null;
  jobsInFlight: number;
  jobsDispatched: number;
  /** The exact `health.lastError` text a connection carries after a fallback. */
  fallbackMessage: string;
  /** `uvx --from … ohshi runner --cloud-url … --token OHR_TOKEN` */
  command: string;
  tokenPlaceholder: string;
}

export function commandWithToken(status: RunnerStatus, token: string): string {
  return status.command.replace(status.tokenPlaceholder, token);
}

export default function ConnectorCard(props: {
  status: RunnerStatus | null;
  error: string | null;
  /** Accounts currently switched to "Run on my machine". */
  preferLocalCount: number;
  onChanged: () => void;
}) {
  const { status } = props;
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);

  const active = (status?.tokens ?? []).filter((t) => t.revokedMs === null);
  const revoked = (status?.tokens ?? []).filter((t) => t.revokedMs !== null);

  const closeModal = () => {
    setCreateOpen(false);
    setFresh(null);
    setName("");
  };

  const create = () => {
    setCreating(true);
    setNote(null);
    post<{ token: string }>("/api/runner/tokens", { name: name.trim() })
      .then((d) => {
        setFresh(d.token);
        props.onChanged();
      })
      .catch((e) => setNote(friendly(e)))
      .finally(() => setCreating(false));
  };

  const revoke = async (t: RunnerTokenRow) => {
    if (!window.confirm(`Revoke "${t.name || t.prefix}"? A connector using it disconnects immediately.`)) return;
    try {
      await post(`/api/runner/tokens/${t.id}/revoke`);
      props.onChanged();
    } catch (e) {
      setNote(friendly(e));
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-edge bg-panel">
            <Laptop className="h-5 w-5 text-ink-dim" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold tracking-tight">Connector</span>
              <Badge tone="violet">Beta</Badge>
              <StatusPill status={status} />
            </div>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-dim">
              Run your model calls from your own computer instead of Ohshi's servers, so Google sees your
              network. Switch it on per account below. Whenever the connector is offline, those calls simply
              run on Ohshi's servers.
            </p>
            <p className="mt-1 text-xs text-ink-dim">
              {status?.online
                ? `${status.jobsDispatched} request${status.jobsDispatched === 1 ? "" : "s"} routed to ${
                    status.hostname ?? "your machine"
                  } since it connected${status.jobsInFlight ? `, ${status.jobsInFlight} running now` : ""}. ${
                    props.preferLocalCount
                      ? `${props.preferLocalCount} account${props.preferLocalCount === 1 ? "" : "s"} set to run there.`
                      : "No account is set to run there yet."
                  }`
                : props.preferLocalCount
                  ? `${props.preferLocalCount} account${
                      props.preferLocalCount === 1 ? " is" : "s are"
                    } set to run on your machine, so their calls run on Ohshi's servers until the connector is back.`
                  : "Nothing is routed through it yet."}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New token
          </Button>
        </div>
      </div>

      {props.error && (
        <div className="mt-4">
          <Notice tone="warn">{props.error}</Notice>
        </div>
      )}
      {note && (
        <div className="mt-4">
          <Notice tone="danger" onClose={() => setNote(null)}>
            {note}
          </Notice>
        </div>
      )}

      <div className="mt-5 grid gap-5 border-t border-edge pt-5 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h3 className="text-[13px] font-bold tracking-tight">Tokens</h3>
          <p className="text-[11px] text-ink-dim">One per machine. Each is shown once, like an API key.</p>
          {active.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-edge bg-ink/[0.02] px-4 py-4 text-xs text-ink-dim">
              No connector tokens yet. Create one, run the command on your computer, then switch an account to
              “Run on my machine”.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-edge">
              {[...active, ...(showRevoked ? revoked : [])].map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{t.name || "Untitled machine"}</p>
                    <p className="text-[11px] text-ink-dim">
                      <span className="mono">{t.prefix}…</span>, created {timeAgo(t.createdMs)}, last seen{" "}
                      {timeAgo(t.lastSeenMs)}
                    </p>
                  </div>
                  {t.revokedMs !== null ? (
                    <Badge tone="danger">Revoked {timeAgo(t.revokedMs)}</Badge>
                  ) : (
                    <Button size="sm" tone="danger" onClick={() => void revoke(t)}>
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {revoked.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRevoked((v) => !v)}
              className="mt-3 text-xs font-semibold text-ink-dim hover:text-ink"
            >
              {showRevoked ? "Hide" : "Show"} {revoked.length} revoked token{revoked.length > 1 ? "s" : ""}
            </button>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="text-[13px] font-bold tracking-tight">Run it on your computer</h3>
          <p className="text-[11px] text-ink-dim">
            Needs Python 3.11+ and <span className="mono">uv</span>. Put your token in place of{" "}
            <span className="mono">{status?.tokenPlaceholder ?? "OHR_TOKEN"}</span>; both flags are remembered,
            so after the first run <span className="mono">ohshi runner</span> alone is enough.
          </p>
          <div className="mt-3">
            <CommandBox command={status?.command ?? "…"} />
          </div>
          <p className="mt-2 text-[11px] text-ink-dim">
            It reconnects by itself after sleep or a network blip. Sign a Google account in from that machine
            with <span className="mono">ohshi runner connect</span> and it appears here, set to run there.
          </p>
        </div>
      </div>

      <Modal open={createOpen} onClose={closeModal} title={fresh ? "Copy your connector token" : "New connector token"}>
        {fresh && status ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-dim">
              This is the only time the full token is shown. Run the command below on the computer that should
              make the calls.
            </p>
            <SecretBox value={fresh} label="Copy token" />
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
                Ready-to-run command
              </p>
              <CommandBox command={commandWithToken(status, fresh)} />
            </div>
            <Button onClick={closeModal}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Machine" hint="Something you'll recognise, like “work laptop”.">
              <Input value={name} onChange={setName} placeholder="my laptop" autoFocus onEnter={create} />
            </Field>
            <Button onClick={create} busy={creating}>
              Create token
            </Button>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function StatusPill(props: { status: RunnerStatus | null }) {
  const s = props.status;
  if (!s) return <Badge>Checking…</Badge>;
  if (s.online) {
    return (
      <>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ok-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ok">
          <span className="live-dot" aria-hidden />
          Online
        </span>
        <span className="min-w-0 truncate text-xs text-ink-dim">
          {s.hostname ?? "your machine"}, seen {timeAgo(s.lastSeenMs)}
        </span>
      </>
    );
  }
  return (
    <>
      <Badge>Offline</Badge>
      {s.lastSeenMs ? <span className="text-xs text-ink-dim">last seen {timeAgo(s.lastSeenMs)}</span> : null}
    </>
  );
}

function SecretBox(props: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-night p-3 text-white">
      <code className="mono min-w-0 flex-1 break-all text-xs">{props.value}</code>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-white/10 p-2 hover:bg-white/20"
        onClick={() => {
          void copyText(props.value).then((ok) => setCopied(ok));
        }}
        aria-label={props.label}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function CommandBox(props: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          void copyText(props.command).then((ok) => {
            setCopied(ok);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-ink/10 px-2.5 py-1 text-[11px] font-semibold text-ink-dim transition-colors hover:bg-ink/20 hover:text-ink"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <Code className="whitespace-pre-wrap break-words pr-24 [overflow-wrap:anywhere]">{props.command}</Code>
    </div>
  );
}
