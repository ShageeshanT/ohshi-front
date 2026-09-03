/**
 * Pasted provider API keys — the supported path for a provider that sells
 * access by key: Gemini (Google AI Studio) and DeepSeek (platform.deepseek.com).
 * Paste a key once; the provider bills that key for what you use, Ohshi
 * routes chat and /v1 to it. One component, one `ProviderSpec` per provider.
 *
 * Data (the same shape under each provider's prefix):
 *   GET  {api}                  -> {keys, route, maxKeys, …}
 *   POST {api} {key, label}     -> {key, created, route}   (never echoes the key)
 *   POST {api}/:id/default      -> {ok, route}
 *   POST {api}/:id/test         -> {ok, latencyMs, model, reply, health, error}
 *   POST {api}/:id/revoke       -> {ok, route}
 *   GET  {api}/:id/models       -> {count, models, default, popular} (cached ~10 min)
 *   GET  {api}/:id/balance      -> {available, currency, total, …}  (providers with a meter)
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

export interface KeyRow {
  id: string;
  label: string;
  prefix: string;
  status: "active" | "invalid";
  isDefault: boolean;
  createdMs: number;
  updatedMs: number;
  health: KeyHealth;
}

export type RouteKind = "gemini_api" | "deepseek_api" | "code_assist" | "chatgpt" | "deepseek_chat";

/** Which credential chat and /v1 run on right now. */
export interface RouteSummary {
  kind: RouteKind;
  id: string;
  label: string;
  beta: boolean;
}

export interface KeysPayload {
  keys: KeyRow[];
  route: RouteSummary | null;
  maxKeys: number;
  /** Gemini: where to create a key. */
  studioUrl?: string;
  /** DeepSeek: where to create a key, and where to top up. */
  platformUrl?: string;
  topUpUrl?: string;
}

/** The prepaid balance behind a DeepSeek key — its real quota. */
export interface KeyBalance {
  available: boolean;
  currency: string;
  total: number | null;
  granted: number | null;
  toppedUp: number | null;
  cached: boolean;
  topUpUrl?: string;
}

export interface ProviderSpec {
  /** The route kind the backend reports for this provider's keys. */
  kind: RouteKind;
  /** The API prefix, e.g. "/api/gemini/keys". */
  api: string;
  /** The noun used in copy: "Gemini API key". */
  noun: string;
  /** Who bills the key and who rejects it: "Google". */
  vendor: string;
  /** Where a key comes from, and how that place is named in copy. */
  consoleUrl: string;
  consoleLabel: string;
  /** What a key starts with. */
  prefix: string;
  /** The provider exposes a balance for the key. */
  hasBalance: boolean;
}

export const GEMINI_SPEC: ProviderSpec = {
  kind: "gemini_api",
  api: "/api/gemini/keys",
  noun: "Gemini API key",
  vendor: "Google",
  consoleUrl: "https://aistudio.google.com/apikey",
  consoleLabel: "aistudio.google.com/apikey",
  prefix: "AIza",
  hasBalance: false,
};

export const DEEPSEEK_SPEC: ProviderSpec = {
  kind: "deepseek_api",
  api: "/api/deepseek/keys",
  noun: "DeepSeek API key",
  vendor: "DeepSeek",
  consoleUrl: "https://platform.deepseek.com/api_keys",
  consoleLabel: "platform.deepseek.com/api_keys",
  prefix: "sk-",
  hasBalance: true,
};

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
  key?: KeyRow;
}

export function keyName(k: KeyRow): string {
  return k.label || k.prefix;
}

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", CNY: "¥" };

/** "$12.30" / "¥12.30" / "12.30 EUR" / "—". */
export function formatBalance(b: KeyBalance): string {
  if (b.total === null) return "—";
  const amount = b.total.toFixed(2);
  const symbol = CURRENCY_SYMBOL[b.currency];
  return symbol ? `${symbol}${amount}` : `${amount} ${b.currency}`.trim();
}

/** One plain language line per key: working, rejected, failing or untested. */
function healthLine(spec: ProviderSpec, k: KeyRow, testing: boolean): { tone: Tone; text: string } {
  if (testing) return { tone: "dim", text: "Testing, sending a tiny message…" };
  if (k.status === "invalid") {
    return { tone: "danger", text: `${spec.vendor} rejected this key. Paste a new one from ${spec.consoleLabel}.` };
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

export default function ProviderKeysCard(props: {
  spec: ProviderSpec;
  payload: KeysPayload | null;
  error: string | null;
  addOpen: boolean;
  onAddOpen: (open: boolean) => void;
  onChanged: () => void;
  onFlash: (flash: { tone: Tone; text: string }) => void;
}) {
  const { spec, payload } = props;
  const keys = payload?.keys ?? [];
  const consoleUrl = payload?.studioUrl ?? payload?.platformUrl ?? spec.consoleUrl;
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
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
    post<{ key: KeyRow; created: boolean }>(spec.api, { key: raw, label: label.trim() })
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
              title={`No ${spec.noun} yet`}
              hint={`Paste one from ${spec.consoleLabel}. It is stored encrypted and only the prefix is ever shown again.`}
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
                  {spec.hasBalance && <th className="num">Balance</th>}
                  <th className="num">Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <KeyTableRow
                    key={k.id}
                    spec={spec}
                    row={k}
                    route={payload.route}
                    onChanged={props.onChanged}
                    onFlash={props.onFlash}
                  />
                ))}
              </tbody>
            </table>
            <p className="border-t border-edge px-4 py-2 text-[11.5px] text-ink-dim">
              {keys.length} of {payload.maxKeys} keys. Stored encrypted; {spec.vendor} bills each key for what it is used
              for.
            </p>
          </div>
        )}
      </Card>

      <Modal open={props.addOpen} onClose={close} title={`Add a ${spec.noun}`}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-ink-dim">
            Create a key at{" "}
            <a href={consoleUrl} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-2 hover:underline">
              {spec.consoleLabel}
            </a>{" "}
            and paste it here. It starts with <span className="mono">{spec.prefix}</span>. Ohshi keeps it encrypted and
            never shows it again.
          </p>
          <Field label="Label" hint="Something you'll recognise, like “personal” or “work project”.">
            <Input value={label} onChange={setLabel} placeholder="personal" autoFocus onEnter={save} />
          </Field>
          <Field label="API key">
            {/* A secret: masked while typed (screen shares, recordings, shoulders), shown on request. */}
            <div className="flex items-center gap-2">
              <Input
                value={key}
                onChange={setKey}
                placeholder={`${spec.prefix}…`}
                mono
                type={showKey ? "text" : "password"}
                autoComplete="off"
                onEnter={save}
                className="flex-1"
              />
              <Button tone="ghost" size="sm" onClick={() => setShowKey((v) => !v)}>
                {showKey ? "Hide" : "Show"}
              </Button>
            </div>
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

function KeyTableRow(props: {
  spec: ProviderSpec;
  row: KeyRow;
  route: RouteSummary | null;
  onChanged: () => void;
  onFlash: (flash: { tone: Tone; text: string }) => void;
}) {
  const { spec } = props;
  const k = props.row;
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [models, setModels] = useState<KeyModels | null>(null);
  const [balance, setBalance] = useState<KeyBalance | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const line = healthLine(spec, k, testing);
  const active = k.status === "active";
  const isRoute = props.route?.kind === spec.kind && props.route.id === k.id;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    get<KeyModels>(`${spec.api}/${k.id}/models`)
      .then((d) => {
        if (!cancelled) setModels(d);
      })
      .catch(() => {
        /* the health line already says what is wrong */
      });
    if (spec.hasBalance) {
      get<KeyBalance>(`${spec.api}/${k.id}/balance`)
        .then((d) => {
          if (!cancelled) setBalance(d);
        })
        .catch(() => {
          if (!cancelled) setBalance(null);
        });
    }
    return () => {
      cancelled = true;
    };
    // k.updatedMs: a test or a re-paste changes what the provider would answer.
  }, [spec.api, spec.hasBalance, k.id, active, k.status, k.updatedMs]);

  const runTest = () => {
    setTesting(true);
    setTest(null);
    post<TestResult>(`${spec.api}/${k.id}/test`)
      .then(setTest)
      .catch((e) => setTest({ ok: false, latencyMs: 0, model: "", error: friendly(e) }))
      .finally(() => {
        setTesting(false);
        props.onChanged();
      });
  };

  const makeDefault = () => {
    setBusy(true);
    post(`${spec.api}/${k.id}/default`)
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
        `Remove ${keyName(k)} from Ohshi? The key itself stays valid at ${spec.vendor}; revoke it at ${spec.consoleLabel} if it leaked.`,
      )
    )
      return;
    setBusy(true);
    post(`${spec.api}/${k.id}/revoke`)
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
      {spec.hasBalance && (
        <td className="num whitespace-nowrap text-[12px]">
          {!active ? (
            <span className="text-ink-dim">—</span>
          ) : balance === undefined ? (
            <span className="text-ink-dim">…</span>
          ) : balance === null ? (
            <span className="text-ink-dim" title="Could not read the balance">
              unknown
            </span>
          ) : balance.available ? (
            <span className="tnum font-medium" title={`${balance.granted ?? 0} granted, ${balance.toppedUp ?? 0} topped up`}>
              {formatBalance(balance)}
            </span>
          ) : (
            <a
              href={balance.topUpUrl ?? spec.consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-danger underline-offset-2 hover:underline"
            >
              {formatBalance(balance)}, top up
            </a>
          )}
        </td>
      )}
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
