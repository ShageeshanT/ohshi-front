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
import { Plus, Star, Trash2, Zap } from "lucide-react";
import { friendly, get, post, timeAgo } from "../lib/api";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Notice, toneTextClass, type Tone } from "./ui";

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
    return { tone: "dim", text: "Not tested yet" };
  }
  if (h.status === "ok") {
    const latency = h.lastLatencyMs != null ? ` in ${(h.lastLatencyMs / 1000).toFixed(1)}s` : "";
    return { tone: "ok", text: `${h.lastModel ?? "Replied"}${latency}, ${timeAgo(h.lastOkMs)}` };
  }
  const status = h.lastErrorStatus ? `HTTP ${h.lastErrorStatus}, ` : "";
  return {
    tone: h.lastErrorStatus === 429 ? "warn" : "danger",
    text: `${status}${h.lastError ?? "unknown error"}, ${timeAgo(h.lastErrorMs)}`,
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
    <>
      <Card flush>
        {props.error && (
          <div className="p-3">
            <Notice tone="warn">{props.error}</Notice>
          </div>
        )}
        {payload === null ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-ink-dim">Checking your keys…</p>
        ) : keys.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No Gemini API key yet"
              hint="Paste one from Google AI Studio. It is stored encrypted and only the prefix is ever shown again."
              action={
                <Button onClick={() => props.onAddOpen(true)} arrow>
                  <Plus className="h-3.5 w-3.5" /> Add a key
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Status</th>
                  <th>Last check</th>
                  <th>Models</th>
                  <th className="num">Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <KeyRow key={k.id} row={k} route={payload.route} onChanged={props.onChanged} onFlash={props.onFlash} />
                ))}
              </tbody>
            </table>
            <p className="border-t border-edge px-4 py-2 text-[11.5px] text-ink-dim">
              {keys.length} of {payload.maxKeys} keys. Stored encrypted; Google bills each key for what it is used for.
            </p>
          </div>
        )}
      </Card>

      <Modal open={props.addOpen} onClose={close} title="Add a Gemini API key">
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-ink-dim">
            Create a key at{" "}
            <a href={studioUrl} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-2 hover:underline">
              aistudio.google.com/apikey
            </a>{" "}
            and paste it here. It starts with <span className="mono">AIza</span>. Ohshi keeps it encrypted and
            never shows it again.
          </p>
          <Field label="Label" hint="Something you'll recognise, like “personal” or “work project”.">
            <Input value={label} onChange={setLabel} placeholder="personal" autoFocus onEnter={save} />
          </Field>
          <Field label="API key">
            <Input value={key} onChange={setKey} placeholder="AIza…" mono autoComplete="off" onEnter={save} />
          </Field>
          {note && <p className="text-[13px] text-warn">{note}</p>}
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
    </>
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
    <tr>
      <td>
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{keyName(k)}</span>
          {isRoute && (
            <Badge tone="accent">
              <Star className="h-3 w-3" /> Default
            </Badge>
          )}
        </div>
        <span className="mono text-[11.5px] text-ink-dim">{k.prefix}…</span>
      </td>
      <td>
        {active ? (
          k.health?.status === "error" ? (
            <Badge tone="danger" dot>
              Not answering
            </Badge>
          ) : (
            <Badge tone="ok" dot>
              Active
            </Badge>
          )
        ) : (
          <Badge tone="danger" dot>
            Rejected
          </Badge>
        )}
      </td>
      <td className="max-w-[16rem]">
        <span className={`block truncate text-[12px] ${toneTextClass(line.tone)}`} title={line.text}>
          {line.text}
        </span>
        {test && !testing && (
          <span className={`block truncate text-[12px] ${test.ok ? "text-ok" : "text-danger"}`}>
            {test.ok
              ? `Test passed, “${test.reply}” from ${test.model} in ${(test.latencyMs / 1000).toFixed(1)}s`
              : `Test failed, ${test.error}`}
          </span>
        )}
      </td>
      <td className="max-w-[14rem] text-[12px] text-ink-dim">
        {models ? (
          <span className="block truncate" title={preview}>
            {models.count} model{models.count === 1 ? "" : "s"}
            {preview ? ` · ${preview}` : ""}
          </span>
        ) : active ? (
          "…"
        ) : (
          "—"
        )}
      </td>
      <td className="num whitespace-nowrap text-[12px] text-ink-dim">{timeAgo(k.createdMs)}</td>
      <td className="num">
        <div className="flex justify-end gap-1">
          {active && (
            <Button size="sm" tone="ghost" busy={testing} onClick={runTest} title="Send a tiny message on this key">
              <Zap className="h-3.5 w-3.5" /> Test
            </Button>
          )}
          {active && !isRoute && (
            <Button size="sm" tone="ghost" busy={busy} onClick={makeDefault}>
              <Star className="h-3.5 w-3.5" /> Default
            </Button>
          )}
          <Button size="sm" tone="danger" busy={busy} onClick={remove} title="Remove from Ohshi">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
