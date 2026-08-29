/**
 * Dashboard — connected Google accounts, live remaining quota per model, and
 * what your agents used through the gateway.
 *
 * Data:
 *   GET /api/google/connections                    -> {connections, redirectMode, endpoints}
 *   GET /api/google/connections/:id/quota[?force=1] -> QuotaSnapshot (or 502 {error, stale})
 *   POST /api/google/connections/:id/test           -> {ok, latencyMs, endpointLabel, error, health}
 *   GET /api/usage/summary?days=30                  -> totals / byModel / series / recent
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, ChevronDown, ChevronUp, Plug, RefreshCw, Star, Trash2, Zap } from "lucide-react";
import ConnectGoogleModal from "../components/ConnectGoogleModal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Notice,
  Progress,
  Spinner,
  StatChip,
  quotaTone,
} from "../components/ui";
import { ApiError, countdown, formatNumber, friendly, get, poll, post, timeAgo } from "../lib/api";

// --- payload shapes (match ohshi/db/models.py + ohshi/google/quota.py) -------

interface Health {
  status: "ok" | "error" | "unknown";
  lastOkMs?: number | null;
  lastErrorMs?: number | null;
  lastError?: string | null;
  lastErrorStatus?: number | null;
  lastModel?: string | null;
  lastEndpoint?: string | null;
  lastLatencyMs?: number | null;
  consecutiveFailures?: number;
}

interface Connection {
  id: string;
  email: string;
  projectId: string;
  endpoint: string;
  tier: string;
  status: "active" | "needs_reconnect" | "revoked";
  isDefault: boolean;
  connectedMs: number;
  health: Health;
}

interface ConnectionsPayload {
  connections: Connection[];
  redirectMode: "paste" | "callback";
  endpoints: { url: string; label: string }[];
}

interface ModelQuota {
  id: string;
  displayName: string;
  familyId: string;
  effort: string;
  known: boolean;
  remainingPercent: number | null;
  resetMs: number | null;
  exhausted: boolean;
}

interface FamilyQuota {
  id: string;
  label: string;
  vendor: string;
  known: boolean;
  remainingPercent: number | null;
  exhausted: boolean;
  resetMs: number | null;
  variants: ModelQuota[];
}

interface QuotaSnapshot {
  connectionId: string;
  fetchedMs: number;
  endpointLabel: string;
  cached: boolean;
  modelCount: number;
  summary: { exhausted: string[]; nextResetMs: number | null; lowest: ModelQuota | null };
  families: FamilyQuota[];
}

interface QuotaState {
  snapshot: QuotaSnapshot | null;
  error: string | null;
  loading: boolean;
}

interface TestResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  endpointLabel?: string;
  reply?: string;
  error?: string;
  tried?: string[];
  health?: Health;
}

interface UsageSummary {
  windowDays: number;
  totals: { requests: number; promptTokens: number; completionTokens: number; totalTokens: number; errors: number };
  byModel: { model: string; requests: number; totalTokens: number; errors: number }[];
  recent: {
    id: number;
    createdMs: number;
    apiModel: string;
    endpoint: string;
    status: string;
    httpStatus: number | null;
    error: string | null;
    totalTokens: number;
    latencyMs: number;
    streamed: boolean;
  }[];
}

const VENDOR_LABEL: Record<string, string> = { google: "Gemini", anthropic: "Claude", openai: "GPT-OSS" };

function endpointNote(endpoint?: string | null): string {
  if (!endpoint) return "";
  if (endpoint.includes("daily-")) return " · via Google's daily endpoint";
  if (endpoint.includes("autopush-")) return " · via Google's autopush endpoint";
  return "";
}

function healthLine(c: Connection): { tone: "ok" | "warn" | "danger" | "dim"; text: string } {
  if (c.status === "needs_reconnect") {
    return { tone: "danger", text: "Google no longer accepts this sign-in — reconnect the account." };
  }
  const h = c.health;
  if (!h || h.status === "unknown") {
    return { tone: "dim", text: "Not tested yet — click Test to check it actually answers." };
  }
  if (h.status === "ok") {
    const latency = h.lastLatencyMs != null ? ` in ${(h.lastLatencyMs / 1000).toFixed(1)}s` : "";
    return {
      tone: "ok",
      text: `Working — ${h.lastModel ?? "it"} replied${latency} · ${timeAgo(h.lastOkMs)}${endpointNote(h.lastEndpoint)}`,
    };
  }
  const status = h.lastErrorStatus ? `HTTP ${h.lastErrorStatus} — ` : "";
  return {
    tone: h.lastErrorStatus === 429 ? "warn" : "danger",
    text: `Failing — ${status}${h.lastError ?? "unknown error"} · ${timeAgo(h.lastErrorMs)}`,
  };
}

// --- page ---------------------------------------------------------------------

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Record<string, QuotaState>>({});
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "danger"; text: string } | null>(() => {
    const connected = params.get("connected");
    const error = params.get("connect_error");
    if (connected) return { tone: "ok", text: `Connected ${connected}.` };
    if (error) return { tone: "danger", text: error };
    return null;
  });

  useEffect(() => {
    if (params.has("connected") || params.has("connect_error")) setParams({}, { replace: true });
  }, [params, setParams]);

  const loadConnections = useCallback(async () => {
    try {
      const data = await get<ConnectionsPayload>("/api/google/connections");
      setConnections(data.connections);
      setLoadError(null);
    } catch (e) {
      setLoadError(friendly(e));
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      setUsage(await get<UsageSummary>("/api/usage/summary?days=30"));
    } catch {
      /* the connections section is the important one */
    }
  }, []);

  const loadQuota = useCallback(async (id: string, force = false) => {
    setQuotas((q) => ({ ...q, [id]: { snapshot: q[id]?.snapshot ?? null, error: null, loading: true } }));
    try {
      const snap = await get<QuotaSnapshot>(`/api/google/connections/${id}/quota${force ? "?force=1" : ""}`);
      setQuotas((q) => ({ ...q, [id]: { snapshot: snap, error: null, loading: false } }));
    } catch (e) {
      const stale = e instanceof ApiError ? (e.body as { stale?: QuotaSnapshot | null } | null)?.stale ?? null : null;
      setQuotas((q) => ({
        ...q,
        [id]: { snapshot: stale ?? q[id]?.snapshot ?? null, error: friendly(e), loading: false },
      }));
    }
  }, []);

  useEffect(() => poll(loadConnections, 20_000), [loadConnections]);
  useEffect(() => poll(loadUsage, 30_000), [loadUsage]);

  // Quota per connection: fetch when the list changes, refresh every 60s.
  const connectionIds = useMemo(() => (connections ?? []).filter((c) => c.status === "active").map((c) => c.id).join(","), [connections]);
  useEffect(() => {
    if (!connectionIds) return;
    const ids = connectionIds.split(",");
    return poll(async () => {
      await Promise.all(ids.map((id) => loadQuota(id)));
    }, 60_000);
  }, [connectionIds, loadQuota]);

  const onConnected = (email: string) => {
    setConnectOpen(false);
    setFlash({ tone: "ok", text: `Connected ${email}.` });
    void loadConnections();
  };

  const disconnect = async (c: Connection) => {
    if (!window.confirm(`Disconnect ${c.email}? Agents using this account will stop until you reconnect.`)) return;
    try {
      await post(`/api/google/connections/${c.id}/disconnect`);
      setQuotas((q) => {
        const next = { ...q };
        delete next[c.id];
        return next;
      });
      await loadConnections();
    } catch (e) {
      setFlash({ tone: "danger", text: friendly(e) });
    }
  };

  const makeDefault = async (c: Connection) => {
    try {
      await post(`/api/google/connections/${c.id}/default`);
      await loadConnections();
    } catch (e) {
      setFlash({ tone: "danger", text: friendly(e) });
    }
  };

  return (
    <div className="rise-in space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your Google accounts</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Connect once — every model call from your agents runs on your own Google plan.
          </p>
        </div>
        <Button onClick={() => setConnectOpen(true)}>
          <Plug className="h-4 w-4" /> Connect Google account
        </Button>
      </header>

      {flash && (
        <Notice tone={flash.tone} onClose={() => setFlash(null)}>
          {flash.text}
        </Notice>
      )}
      {loadError && <Notice tone="danger">{loadError}</Notice>}

      {connections === null ? (
        <div className="flex justify-center py-10 text-ink-dim">
          <Spinner />
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <EmptyState
            title="No Google account connected yet"
            hint="Sign in with Google, paste the code Google shows you, and your agents get Gemini, Claude and GPT-OSS on that plan — with live remaining quota right here."
            action={
              <Button onClick={() => setConnectOpen(true)}>
                <Plug className="h-4 w-4" /> Connect Google account
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {connections.map((c) => (
            <ConnectionCard
              key={c.id}
              connection={c}
              quota={quotas[c.id] ?? { snapshot: null, error: null, loading: true }}
              onRefreshQuota={() => loadQuota(c.id, true)}
              onDisconnect={() => disconnect(c)}
              onMakeDefault={() => makeDefault(c)}
              onReconnect={() => setConnectOpen(true)}
              onTested={() => {
                void loadConnections();
                void loadQuota(c.id, true);
              }}
              soloAccount={connections.length === 1}
            />
          ))}
        </div>
      )}

      <UsageSection usage={usage} />

      <ConnectGoogleModal open={connectOpen} onClose={() => setConnectOpen(false)} onDone={onConnected} />
    </div>
  );
}

// --- one connected account -------------------------------------------------------

function ConnectionCard(props: {
  connection: Connection;
  quota: QuotaState;
  soloAccount: boolean;
  onRefreshQuota: () => void;
  onDisconnect: () => void;
  onMakeDefault: () => void;
  onReconnect: () => void;
  onTested: () => void;
}) {
  const c = props.connection;
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const line = testing
    ? { tone: "dim" as const, text: "Testing — sending a tiny message…" }
    : healthLine(c);

  const runTest = () => {
    setTesting(true);
    setTest(null);
    post<TestResult>(`/api/google/connections/${c.id}/test`)
      .then((r) => setTest(r))
      .catch((e) => setTest({ ok: false, latencyMs: 0, model: "", error: friendly(e) }))
      .finally(() => {
        setTesting(false);
        props.onTested();
      });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{c.email}</h2>
            {c.isDefault && (
              <Badge tone="accent">
                <Star className="h-3 w-3" /> Default
              </Badge>
            )}
            {c.status === "needs_reconnect" ? (
              <Badge tone="danger">Needs reconnect</Badge>
            ) : (
              <Badge tone="ok">Connected</Badge>
            )}
            {c.tier && <Badge>{c.tier === "free" ? "Code Assist free tier" : `${c.tier} tier`}</Badge>}
          </div>
          <p className={`mt-1.5 text-sm text-${line.tone === "dim" ? "ink-dim" : line.tone}`}>{line.text}</p>
          {test && !testing && (
            <p className={`mt-1 text-xs ${test.ok ? "text-ok" : "text-danger"}`}>
              {test.ok
                ? `Test passed — "${test.reply}" from ${test.model} via ${test.endpointLabel} in ${(test.latencyMs / 1000).toFixed(1)}s`
                : `Test failed — ${test.error}${test.tried?.length ? ` (tried ${test.tried.join(", ")})` : ""}`}
            </p>
          )}
          <p className="mt-1 text-xs text-ink-dim">
            Connected {timeAgo(c.connectedMs)} · project {c.projectId || "pending"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status === "needs_reconnect" ? (
            <Button size="sm" onClick={props.onReconnect}>
              <Plug className="h-3.5 w-3.5" /> Reconnect
            </Button>
          ) : (
            <Button size="sm" tone="ghost" busy={testing} onClick={runTest}>
              <Zap className="h-3.5 w-3.5" /> Test
            </Button>
          )}
          {!c.isDefault && !props.soloAccount && (
            <Button size="sm" tone="ghost" onClick={props.onMakeDefault}>
              <Star className="h-3.5 w-3.5" /> Make default
            </Button>
          )}
          <Button size="sm" tone="danger" onClick={props.onDisconnect}>
            <Trash2 className="h-3.5 w-3.5" /> Disconnect
          </Button>
        </div>
      </div>

      {c.status === "active" && (
        <div className="mt-5 border-t border-edge pt-5">
          <QuotaPanel quota={props.quota} onRefresh={props.onRefreshQuota} />
        </div>
      )}
    </Card>
  );
}

// --- remaining usage -------------------------------------------------------------

function QuotaPanel(props: { quota: QuotaState; onRefresh: () => void }) {
  const { snapshot, error, loading } = props.quota;
  const [showOther, setShowOther] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const known = snapshot?.families.filter((f) => f.known) ?? [];
  const other = snapshot?.families.filter((f) => !f.known) ?? [];
  const exhaustedCount = snapshot?.summary.exhausted.length ?? 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Remaining usage</h3>
          <p className="text-xs text-ink-dim">
            {snapshot
              ? `Live from Google (${snapshot.endpointLabel} endpoint) · ${timeAgo(snapshot.fetchedMs)}${snapshot.cached ? " · cached" : ""}${
                  exhaustedCount ? ` · ${exhaustedCount} model${exhaustedCount > 1 ? "s" : ""} out of quota` : ""
                }`
              : loading
                ? "Reading your quota from Google…"
                : "Quota unavailable"}
          </p>
        </div>
        <Button size="sm" tone="ghost" busy={loading} onClick={props.onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-3">
          <Notice tone="warn">
            {error}
            {snapshot ? " Showing the last reading." : ""}
          </Notice>
        </div>
      )}

      {!snapshot ? (
        loading ? (
          <div className="flex justify-center py-6 text-ink-dim">
            <Spinner />
          </div>
        ) : (
          <EmptyState title="No quota reading yet" hint="Click Refresh to ask Google again." />
        )
      ) : (
        <div className="space-y-2.5">
          {known.length === 0 && other.length === 0 && (
            <EmptyState title="Google listed no models for this account" hint="The plan may not include Antigravity yet." />
          )}
          {known.map((f) => (
            <FamilyRow key={f.id} family={f} now={now} />
          ))}
          {other.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowOther((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-ink-dim hover:text-ink"
              >
                {showOther ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {other.length} other model{other.length > 1 ? "s" : ""} on this account
              </button>
              {showOther && (
                <div className="mt-2 space-y-2.5">
                  {other.map((f) => (
                    <FamilyRow key={f.id} family={f} now={now} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FamilyRow(props: { family: FamilyQuota; now: number }) {
  const f = props.family;
  const tone = quotaTone(f.remainingPercent);
  const percentText = f.remainingPercent === null ? "no quota data" : `${f.remainingPercent}% left`;
  const reset = f.resetMs ? countdown(f.resetMs, props.now) : "";
  const multi = f.variants.length > 1;
  return (
    <div className="rounded-xl bg-panel-2/70 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{f.known ? f.label : f.variants[0]?.displayName ?? f.id}</span>
          <Badge tone="dim">{VENDOR_LABEL[f.vendor] ?? f.vendor}</Badge>
          {f.exhausted && <Badge tone="danger">Out of quota</Badge>}
        </div>
        <span className={`text-xs font-medium ${tone === "dim" ? "text-ink-dim" : `text-${tone}`}`}>
          {percentText}
          {reset && <span className="text-ink-dim"> · resets {reset}</span>}
        </span>
      </div>
      <div className="mt-2">
        <Progress percent={f.remainingPercent} tone={tone} />
      </div>
      {multi && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {f.variants.map((v) => (
            <span
              key={v.id}
              title={`${v.id}${v.resetMs ? ` · resets ${countdown(v.resetMs, props.now)}` : ""}`}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                v.exhausted ? "bg-danger-soft text-danger" : "bg-panel text-ink-dim"
              }`}
            >
              {v.effort || v.id}
              {v.remainingPercent !== null && ` · ${v.remainingPercent}%`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- our own ledger -------------------------------------------------------------

function UsageSection(props: { usage: UsageSummary | null }) {
  const u = props.usage;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-ink-dim" />
        <h2 className="text-base font-semibold">What your agents used</h2>
        <span className="text-xs text-ink-dim">last {u?.windowDays ?? 30} days, through this gateway</span>
      </div>
      {!u ? (
        <div className="flex justify-center py-6 text-ink-dim">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatChip label="Requests" value={formatNumber(u.totals.requests)} />
            <StatChip label="Tokens" value={formatNumber(u.totals.totalTokens)} sub={`${formatNumber(u.totals.promptTokens)} in · ${formatNumber(u.totals.completionTokens)} out`} />
            <StatChip label="Errors" value={formatNumber(u.totals.errors)} tone={u.totals.errors ? "danger" : undefined} />
            <StatChip label="Models used" value={u.byModel.length} />
          </div>
          {u.totals.requests === 0 ? (
            <Card>
              <EmptyState
                title="No calls yet"
                hint="Create an API key and point your agent at /v1 — see Docs. Requests show up here as they happen."
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="By model">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-ink-dim">
                    <tr>
                      <th className="pb-2 font-semibold">Model</th>
                      <th className="pb-2 text-right font-semibold">Requests</th>
                      <th className="pb-2 text-right font-semibold">Tokens</th>
                      <th className="pb-2 text-right font-semibold">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.byModel.map((row) => (
                      <tr key={row.model} className="border-t border-edge">
                        <td className="py-2 mono text-xs">{row.model}</td>
                        <td className="py-2 text-right">{formatNumber(row.requests)}</td>
                        <td className="py-2 text-right">{formatNumber(row.totalTokens)}</td>
                        <td className={`py-2 text-right ${row.errors ? "text-danger" : ""}`}>{row.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card title="Recent calls">
                <ul className="space-y-2">
                  {u.recent.slice(0, 10).map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 border-t border-edge pt-2 text-xs first:border-t-0 first:pt-0">
                      <div className="min-w-0">
                        <p className="mono truncate">{r.apiModel}</p>
                        <p className="text-ink-dim">
                          {timeAgo(r.createdMs)} · {(r.latencyMs / 1000).toFixed(1)}s{r.streamed ? " · streamed" : ""}
                          {r.status !== "ok" && r.error ? ` · ${r.error}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {r.status === "ok" ? (
                          <span>{formatNumber(r.totalTokens)} tokens</span>
                        ) : (
                          <Badge tone="danger">{r.httpStatus ?? "error"}</Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </>
      )}
    </section>
  );
}
