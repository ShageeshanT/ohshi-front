/**
 * Gemini API keys — the supported path. Paste a key from Google AI Studio
 * once; Google bills that key for what you use, Ohshi routes chat and /v1 to
 * it. The Google account connector next to this card stays Beta.
 *
 * Data:
 *   GET  /api/gemini/keys                  -> {keys, route, studioUrl, maxKeys}
 *   POST /api/gemini/keys {key, label}     -> {key, created, route}   (never echoes the key)
 *   POST /api/gemini/keys/:id/default      -> {ok, route}
 *   POST /api/gemini/keys/:id/test         -> {ok, latencyMs, model, reply, health, error}
 *   POST /api/gemini/keys/:id/revoke       -> {ok, route}
 *   GET  /api/gemini/keys/:id/models       -> {count, models, default, popular} (cached ~10 min)
 */

import { useEffect, useState } from "react";
import { ExternalLink, Plus, Star, Trash2, Zap } from "lucide-react";
import { friendly, get, post, timeAgo } from "../lib/api";
import { GeminiLogo } from "./logos";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, type Tone } from "./ui";

export interface KeyHealth {
  status: "ok" | "error" | "unknown";
  lastOkMs?: number | null;
  lastErrorMs?: number | null;
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastModel?: string | null;
  lastLatencyMs?: number | null;
  consecutiveFailures?: number;
}

export interface GeminiKeyRow {
  id: string;
  label: string;
  prefix: string;
  status: "active" | "invalid";
  isDefault: boolean;
  createdMs: number;
  updatedMs: number;
  health: KeyHealth;
}

/** Which credential chat and /v1 run on right now. */
export interface RouteSummary {
  kind: "gemini_api" | "code_assist";
  id: string;
  label: string;
  beta: boolean;
}

export interface GeminiKeysPayload {
  keys: GeminiKeyRow[];
  route: RouteSummary | null;
  studioUrl: string;
  maxKeys: number;
}

interface KeyModels {
  count: number;
  models: { id: string; displayName: string }[];
  default: string;
}

interface TestResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  reply?: string;
  error?: string;
  status?: number;
  key?: GeminiKeyRow;
}

const toneText: Record<Tone, string> = {
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  violet: "text-violet",
  dim: "text-ink-dim",
};

export function keyName(k: GeminiKeyRow): string {
  return k.label || k.prefix;
}

/** One plain language line per key: working, rejected, failing or untested. */
function healthLine(k: GeminiKeyRow, testing: boolean): { tone: Tone; text: string } {
  if (testing) return { tone: "dim", text: "Testing, sending a tiny message…" };
  if (k.status === "invalid") {
    return { tone: "danger", text: "Google rejected this key. Paste a new one from AI Studio." };
  }
  const h = k.health;
  if (!h || h.status === "unknown") {
    return { tone: "dim", text: "Not tested yet. Hit Test to check it actually answers." };
  }
  if (h.status === "ok") {
    const latency = h.lastLatencyMs != null ? ` in ${(h.lastLatencyMs / 1000).toFixed(1)}s` : "";
    return { tone: "ok", text: `Working, ${h.lastModel ?? "it"} replied${latency}, ${timeAgo(h.lastOkMs)}` };
  }
  const status = h.lastErrorStatus ? `HTTP ${h.lastErrorStatus}, ` : "";
  return {
    tone: h.lastErrorStatus === 429 ? "warn" : "danger",
    text: `Failing, ${status}${h.lastError ?? "unknown error"}, ${timeAgo(h.lastErrorMs)}`,
  };
}

export default function GeminiKeysCard(props: {
  payload: GeminiKeysPayload | null;
  error: string | null;
  addOpen: boolean;
  onAddOpen: (open: boolean) => void;
  onChanged: () => void;
  onFlash: (flash: { tone: Tone; text: string }) => void;
}) {
  const { payload } = props;
  const keys = payload?.keys ?? [];
  const studioUrl = payload?.studioUrl ?? "https://aistudio.google.com/apikey";
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const close = () => {
    props.onAddOpen(false);
    setKey("");
    setLabel("");
    setNote(null);
  };

  const save = () => {
    const raw = key.trim();
    if (!raw) return;
    setSaving(true);
    setNote(null);
    post<{ key: GeminiKeyRow; created: boolean }>("/api/gemini/keys", { key: raw, label: label.trim() })
      .then((d) => {
        close();
        props.onFlash({
          tone: "ok",
          text: d.created
            ? `Saved ${keyName(d.key)}.${d.key.isDefault ? " Chat and /v1 now run on it." : ""}`
            : `Updated ${keyName(d.key)}. It was already saved, so nothing was duplicated.`,
        });
        props.onChanged();
      })
      .catch((e) => setNote(friendly(e, "That key could not be saved. Check it and try again.")))
      .finally(() => setSaving(false));
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-edge bg-panel">
            <GeminiLogo className="h-5 w-5 text-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold tracking-tight">Gemini API keys</span>
              <Badge tone="ok">Live</Badge>
              {keys.length > 0 && (
                <span className="text-xs text-ink-dim">
                  {keys.length} of {payload?.maxKeys ?? 10}
                </span>
              )}
            </div>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-ink-dim">
              Paste a key from Google AI Studio once. Google bills that key for what you use, and Ohshi routes
              chat and the API gateway to it. Stored encrypted; only the prefix is ever shown again.
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <a href={studioUrl} target="_blank" rel="noreferrer" className="inline-flex">
            <Button size="sm" tone="ghost">
              <ExternalLink className="h-3.5 w-3.5" /> Get a key
            </Button>
          </a>
          <Button size="sm" onClick={() => props.onAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add key
          </Button>
        </div>
      </div>

      {props.error && (
        <div className="mt-4">
          <Notice tone="warn">{props.error}</Notice>
        </div>
      )}

      <div className="mt-5 border-t border-edge pt-5">
        {payload === null ? (
          <p className="text-xs text-ink-dim">Checking your keys…</p>
        ) : keys.length === 0 ? (
          <EmptyState
            title="Use a Gemini API key from Google AI Studio"
            hint="This is the supported path. The Google account connector below stays Beta."
            action={
              <Button onClick={() => props.onAddOpen(true)} arrow>
                <Plus className="h-4 w-4" /> Add a key
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-edge">
            {keys.map((k) => (
              <KeyRow
                key={k.id}
                row={k}
                route={payload.route}
                onChanged={props.onChanged}
                onFlash={props.onFlash}
              />
            ))}
          </ul>
        )}
      </div>

      <Modal open={props.addOpen} onClose={close} title="Add a Gemini API key">
        <div className="space-y-4">
          <p className="text-sm text-ink-dim">
            Create a key at{" "}
            <a href={studioUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent underline-offset-2 hover:underline">
              aistudio.google.com/apikey
            </a>{" "}
            and paste it here. It starts with <span className="mono">AIza</span>. Ohshi keeps it encrypted and
            never shows it again.
          </p>
          <Field label="Label" hint="Something you'll recognise, like “personal” or “work project”.">
            <Input value={label} onChange={setLabel} placeholder="personal" autoFocus onEnter={save} />
          </Field>
          <Field label="API key">
            <Input
              value={key}
              onChange={setKey}
              placeholder="AIza…"
              mono
              autoComplete="off"
              onEnter={save}
            />
          </Field>
          {note && <p className="text-sm text-warn">{note}</p>}
          <div className="flex gap-2">
            <Button onClick={save} busy={saving} disabled={!key.trim()}>
              Save key
            </Button>
            <Button tone="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function KeyRow(props: {
  row: GeminiKeyRow;
  route: RouteSummary | null;
  onChanged: () => void;
  onFlash: (flash: { tone: Tone; text: string }) => void;
}) {
  const k = props.row;
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [models, setModels] = useState<KeyModels | null>(null);
  const [busy, setBusy] = useState(false);
  const line = healthLine(k, testing);
  const active = k.status === "active";
  const isRoute = props.route?.kind === "gemini_api" && props.route.id === k.id;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    get<KeyModels>(`/api/gemini/keys/${k.id}/models`)
      .then((d) => {
        if (!cancelled) setModels(d);
      })
      .catch(() => {
        /* the health line already says what is wrong */
      });
    return () => {
      cancelled = true;
    };
  }, [k.id, active, k.status]);

  const runTest = () => {
    setTesting(true);
    setTest(null);
    post<TestResult>(`/api/gemini/keys/${k.id}/test`)
      .then(setTest)
      .catch((e) => setTest({ ok: false, latencyMs: 0, model: "", error: friendly(e) }))
      .finally(() => {
        setTesting(false);
        props.onChanged();
      });
  };

  const makeDefault = () => {
    setBusy(true);
    post(`/api/gemini/keys/${k.id}/default`)
      .then(() => {
        props.onFlash({ tone: "ok", text: `Chat and /v1 now run on ${keyName(k)}.` });
        props.onChanged();
      })
      .catch((e) => props.onFlash({ tone: "danger", text: friendly(e) }))
      .finally(() => setBusy(false));
  };

  const remove = () => {
    if (
      !window.confirm(
        `Remove ${keyName(k)} from Ohshi? The key itself stays valid at Google; revoke it in AI Studio if it leaked.`,
      )
    )
      return;
    setBusy(true);
    post(`/api/gemini/keys/${k.id}/revoke`)
      .then(() => props.onChanged())
      .catch((e) => props.onFlash({ tone: "danger", text: friendly(e) }))
      .finally(() => setBusy(false));
  };

  const preview = models?.models
    .slice(0, 3)
    .map((m) => m.displayName)
    .join(", ");

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-bold tracking-tight">{keyName(k)}</span>
          {isRoute && (
            <Badge tone="accent">
              <Star className="h-3 w-3" /> Default
            </Badge>
          )}
          {active ? (
            k.health?.status === "error" ? (
              <Badge tone="danger">Saved, not answering</Badge>
            ) : (
              <Badge tone="ok">Active</Badge>
            )
          ) : (
            <Badge tone="danger">Rejected by Google</Badge>
          )}
        </div>
        <p className={`mt-1.5 text-xs ${toneText[line.tone]}`}>{line.text}</p>
        {test && !testing && (
          <p className={`mt-1 text-xs ${test.ok ? "text-ok" : "text-danger"}`}>
            {test.ok
              ? `Test passed, “${test.reply}” from ${test.model} in ${(test.latencyMs / 1000).toFixed(1)}s`
              : `Test failed, ${test.error}`}
          </p>
        )}
        <p className="mt-1 text-xs text-ink-dim">
          <span className="mono">{k.prefix}</span>, added {timeAgo(k.createdMs)}
          {models ? `, ${models.count} model${models.count === 1 ? "" : "s"} available${preview ? ` (${preview}…)` : ""}` : ""}
        </p>
      </div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {active && (
          <Button size="sm" tone="ghost" busy={testing} onClick={runTest}>
            <Zap className="h-3.5 w-3.5" /> Test
          </Button>
        )}
        {active && !isRoute && (
          <Button size="sm" tone="ghost" busy={busy} onClick={makeDefault}>
            <Star className="h-3.5 w-3.5" /> Make default
          </Button>
        )}
        <Button size="sm" tone="danger" busy={busy} onClick={remove}>
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </Button>
      </div>
    </li>
  );
}
