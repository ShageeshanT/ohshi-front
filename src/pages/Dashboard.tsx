/**
 * Google accounts — connect an account, see whether it actually answers, and
 * watch the remaining usage per model. Plus what your agents spent through the
 * gateway.
 *
 * Data:
 *   GET  /api/google/connections                     -> {connections, redirectMode, endpoints}
 *   GET  /api/google/connections/:id/quota[?force=1] -> QuotaSnapshot (or 502 {error, stale})
 *   POST /api/google/connections/:id/test            -> {ok, latencyMs, endpointLabel, error, health}
 *   GET  /api/usage/summary?days=30                  -> totals / byModel / series / recent
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Plug, RefreshCw, Star, Trash2, Zap } from "lucide-react";
import ConnectGoogleModal from "../components/ConnectGoogleModal";
import { GoogleLogo, vendorLogo } from "../components/logos";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Notice,
  Progress,
  Skeleton,
  Spinner,
  StatChip,
  quotaTone,
  type Tone,
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
}

interface UsageSummary {
  windowDays: number;
  totals: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    errors: number;
  };
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

function endpointNote(endpoint?: string | null): string {
  if (!endpoint) return "";
  if (endpoint.includes("daily-")) return " · via Google's daily endpoint";
  if (endpoint.includes("autopush-")) return " · via Google's autopush endpoint";
  return "";
}

/** One plain-language line per account: working / failing / untested. */
function healthLine(c: Connection, testing: boolean): { tone: Tone; text: string } {
  if (testing) return { tone: "dim", text: "Testing — sending a tiny message…" };
  if (c.status === "needs_reconnect") {
    return { tone: "danger", text: "Google no longer accepts this sign-in — reconnect the account." };
  }
  const h = c.health;
  if (!h || h.status === "unknown") {
    return { tone: "dim", text: "Not tested yet — hit Test to check it actually answers." };
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
  const [flash, setFlash] = useState<{ tone: Tone; text: string } | null>(() => {
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
      /* the accounts section is the important one */
    }
  }, []);

  const loadQuota = useCallback(async (id: string, force = false) => {
    setQuotas((q) => ({ ...q, [id]: { snapshot: q[id]?.snapshot ?? null, error: null, loading: true } }));
    try {
      const snap = await get<QuotaSnapshot>(`/api/google/connections/${id}/quota${force ? "?force=1" : ""}`);
      setQuotas((q) => ({ ...q, [id]: { snapshot: snap, error: null, loading: false } }));
    } catch (e) {
      const stale =
        e instanceof ApiError ? ((e.body as { stale?: QuotaSnapshot | null } | null)?.stale ?? null) : null;
      setQuotas((q) => ({
        ...q,
        [id]: { snapshot: stale ?? q[id]?.snapshot ?? null, error: friendly(e), loading: false },
      }));
    }
  }, []);

  useEffect(() => poll(loadConnections, 20_000), [loadConnections]);
  useEffect(() => poll(loadUsage, 30_000), [loadUsage]);

  const connectionIds = useMemo(
    () =>
      (connections ?? [])
        .filter((c) => c.status === "active")
        .map((c) => c.id)
        .join(","),
    [connections],
  );
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
          <h1 className="text-2xl font-extrabold tracking-tight">
            Your <span className="serif-accent">Google</span> accounts
          </h1>
          <p className="mt-1 text-sm text-ink-dim">
            Connect once — every model call from your agents and from chat runs on your own Google plan.
          </p>
        </div>
        <Button onClick={() => setConnectOpen(true)} arrow>
          <Plug className="h-4 w-4" /> Connect account
        </Button>
      </header>

      {flash && (
        <Notice tone={flash.tone} onClose={() => setFlash(null)}>
          {flash.text}
        </Notice>
      )}
      {loadError && <Notice tone="danger">{loadError}</Notice>}

      {connections === null ? (
        <Card>
          <Spinner label="Checking your accounts…" />
        </Card>
      ) : connections.length === 0 ? (
        <Card>
          <EmptyState
            title="No Google account connected yet"
            hint="Sign in with Google, paste the code it shows you, and your agents get Gemini, Claude and GPT-OSS on that plan — with live remaining quota right here."
            action={
              <Button onClick={() => setConnectOpen(true)} arrow>
                <Plug className="h-4 w-4" /> Connect account
              </Button>
            }
          />
        </Card>
      ) : (
        connections.map((c) => (
          <ConnectionCard
            key={c.id}
            connection={c}
            quota={quotas[c.id] ?? { snapshot: null, error: null, loading: true }}
            soloAccount={connections.length === 1}
            onRefreshQuota={() => loadQuota(c.id, true)}
            onDisconnect={() => disconnect(c)}
            onMakeDefault={() => makeDefault(c)}
            onReconnect={() => setConnectOpen(true)}
            onTested={() => {
              void loadConnections();
              void loadQuota(c.id, true);
            }}
          />
        ))
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
  const line = healthLine(c, testing);
  const lineCls = {
    accent: "text-accent",
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    violet: "text-violet",
    dim: "text-ink-dim",
  }[line.tone];
  const connected = c.status === "active";

  const runTest = () => {
    setTesting(true);
    setTest(null);
    post<TestResult>(`/api/google/connections/${c.id}/test`)
      .then(setTest)
      .catch((e) => setTest({ ok: false, latencyMs: 0, model: "", error: friendly(e) }))
      .finally(() => {
        setTesting(false);
        props.onTested();
      });
  };

  return (
    <Card className={c.isDefault ? "ring-1 ring-accent/25" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-edge bg-panel">
            <GoogleLogo className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-bold tracking-tight">{c.email}</span>
              {c.isDefault && (
                <Badge tone="accent">
                  <Star className="h-3 w-3" /> Default
                </Badge>
              )}
              {connected ? (
                c.health?.status === "error" ? (
                  <Badge tone="danger">Connected · not answering</Badge>
                ) : (
                  <Badge tone="ok">Connected</Badge>
                )
              ) : (
                <Badge tone="danger">Needs reconnect</Badge>
              )}
              {c.tier && <Badge>{c.tier === "free" ? "Code Assist free tier" : `${c.tier} tier`}</Badge>}
            </div>
            <p className={`mt-1.5 text-xs ${lineCls}`}>{line.text}</p>
            {test && !testing && (
              <p className={`mt-1 text-xs ${test.ok ? "text-ok" : "text-danger"}`}>
                {test.ok
                  ? `Test passed — “${test.reply}” from ${test.model} via ${test.endpointLabel} in ${(test.latencyMs / 1000).toFixed(1)}s`
                  : `Test failed — ${test.error}${test.tried?.length ? ` (tried ${test.tried.join(", ")})` : ""}`}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-dim">
              Connected {timeAgo(c.connectedMs)} · project {c.projectId || "pending"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <Button size="sm" tone="ghost" busy={testing} onClick={runTest}>
              <Zap className="h-3.5 w-3.5" /> Test
            </Button>
          ) : (
            <Button size="sm" onClick={props.onReconnect}>
              <Plug className="h-3.5 w-3.5" /> Reconnect
            </Button>
          )}
          {!c.isDefault && !props.soloAccount && connected && (
            <Button size="sm" tone="ghost" onClick={props.onMakeDefault}>
              <Star className="h-3.5 w-3.5" /> Make default
            </Button>
          )}
          <Button size="sm" tone="danger" onClick={props.onDisconnect}>
            <Trash2 className="h-3.5 w-3.5" /> Disconnect
          </Button>
        </div>
      </div>

      {connected && (
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const exhaustedCount = snapshot?.summary.exhausted.length ?? 0;

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-bold tracking-tight">Remaining usage</h3>
          <p className="text-[11px] text-ink-dim">
            {snapshot
              ? `Live from Google · ${snapshot.endpointLabel} endpoint · ${timeAgo(snapshot.fetchedMs)}${
                  snapshot.cached ? " · cached" : ""
                }${exhaustedCount ? ` · ${exhaustedCount} model${exhaustedCount > 1 ? "s" : ""} out of quota` : ""}`
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
          <div className="grid gap-1.5 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
                <Skeleton className="h-2.5 w-32" />
                <Skeleton className="mt-2 h-1.5 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No quota reading yet" hint="Hit Refresh to ask Google again." />
        )
      ) : snapshot.families.length === 0 ? (
        <EmptyState
          title="Google listed no models for this account"
          hint="The plan may not include Antigravity yet."
        />
      ) : (
        <div className="grid gap-1.5 md:grid-cols-2">
          {snapshot.families.map((f) => (
            <FamilyRow key={f.id} family={f} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

function FamilyRow(props: { family: FamilyQuota; now: number }) {
  const f = props.family;
  const tone = quotaTone(f.remainingPercent);
  const Logo = vendorLogo(f.vendor);
  const reset = f.resetMs ? countdown(f.resetMs, props.now) : "";
  const toneCls = {
    accent: "text-accent",
    ok: "text-ok",
    warn: "text-warn",
    danger: "text-danger",
    violet: "text-violet",
    dim: "text-ink-dim",
  }[tone];

  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 transition-colors duration-300 hover:bg-white/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Logo className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
          <span className="truncate text-[12.5px] font-semibold">
            {f.known ? f.label : (f.variants[0]?.displayName ?? f.id)}
          </span>
        </span>
        <span className={`shrink-0 text-[11px] font-semibold ${toneCls}`}>
          {f.remainingPercent === null ? "—" : f.exhausted ? "out of quota" : `${f.remainingPercent}%`}
          {reset && <span className="ml-1 font-medium text-ink-dim">· {reset}</span>}
        </span>
      </div>
      <div className="mt-1.5">
        <Progress percent={f.remainingPercent} tone={tone} className="h-1.5" />
      </div>
      {f.variants.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {f.variants.map((v) => (
            <span
              key={v.id}
              title={`${v.id}${v.resetMs ? ` · resets ${countdown(v.resetMs, props.now)}` : ""}`}
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                v.exhausted ? "bg-danger-soft text-danger line-through" : "bg-white/[0.07] text-ink-dim"
              }`}
            >
              {v.effort || v.id}
              {v.remainingPercent !== null && ` ${v.remainingPercent}%`}
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
        <h2 className="text-base font-bold tracking-tight">What your agents used</h2>
        <span className="text-xs text-ink-dim">last {u?.windowDays ?? 30} days, through this gateway</span>
      </div>
      {!u ? (
        <Card>
          <Spinner label="Loading usage…" />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatChip label="Requests" value={formatNumber(u.totals.requests)} />
            <StatChip
              label="Tokens"
              value={formatNumber(u.totals.totalTokens)}
              sub={`${formatNumber(u.totals.promptTokens)} in · ${formatNumber(u.totals.completionTokens)} out`}
            />
            <StatChip
              label="Errors"
              value={formatNumber(u.totals.errors)}
              tone={u.totals.errors ? "danger" : undefined}
            />
            <StatChip label="Models used" value={u.byModel.length} />
          </div>
          {u.totals.requests === 0 ? (
            <Card>
              <EmptyState
                title="No calls yet"
                hint="Start a chat, or create an API key and point your agent at /v1 — requests show up here as they happen."
                action={
                  <Link to="/">
                    <Button tone="ghost">Open chat</Button>
                  </Link>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="By model">
                <table className="w-full text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-[0.12em] text-ink-dim">
                    <tr>
                      <th className="pb-2 font-semibold">Model</th>
                      <th className="pb-2 text-right font-semibold">Calls</th>
                      <th className="pb-2 text-right font-semibold">Tokens</th>
                      <th className="pb-2 text-right font-semibold">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.byModel.map((row) => (
                      <tr key={row.model} className="border-t border-edge">
                        <td className="mono py-2 text-xs">{row.model}</td>
                        <td className="py-2 text-right">{formatNumber(row.requests)}</td>
                        <td className="py-2 text-right">{formatNumber(row.totalTokens)}</td>
                        <td className={`py-2 text-right ${row.errors ? "font-semibold text-danger" : ""}`}>
                          {row.errors}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card title="Recent calls">
                <ul className="space-y-2">
                  {u.recent.slice(0, 10).map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-3 border-t border-edge pt-2 text-xs first:border-t-0 first:pt-0"
                    >
                      <div className="min-w-0">
                        <p className="mono truncate">{r.apiModel}</p>
                        <p className="text-ink-dim">
                          {timeAgo(r.createdMs)} · {(r.latencyMs / 1000).toFixed(1)}s
                          {r.streamed ? " · streamed" : ""}
                          {r.status !== "ok" && r.error ? ` · ${r.error}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {r.status === "ok" ? (
                          <span className="font-medium">{formatNumber(r.totalTokens)} tokens</span>
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
