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
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleGauge,
  KeyRound,
  MessageSquare,
  Plug,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  TriangleAlert,
  WandSparkles,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../App";
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
  entitlement: {
    plan: string;
    label: string;
    period: string;
    requestLimit: number;
    requestsUsed: number;
    requestsRemaining: number;
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
  if (endpoint.includes("daily-")) return ", via Google's daily endpoint";
  if (endpoint.includes("autopush-")) return ", via Google's autopush endpoint";
  return "";
}

/** One plain language line per account: working, failing or untested. */
function healthLine(c: Connection, testing: boolean): { tone: Tone; text: string } {
  if (testing) return { tone: "dim", text: "Testing, sending a tiny message…" };
  if (c.status === "needs_reconnect") {
    return { tone: "danger", text: "Google no longer accepts this sign in. Reconnect the account." };
  }
  const h = c.health;
  if (!h || h.status === "unknown") {
    return { tone: "dim", text: "Not tested yet. Hit Test to check it actually answers." };
  }
  if (h.status === "ok") {
    const latency = h.lastLatencyMs != null ? ` in ${(h.lastLatencyMs / 1000).toFixed(1)}s` : "";
    return {
      tone: "ok",
      text: `Working, ${h.lastModel ?? "it"} replied${latency}, ${timeAgo(h.lastOkMs)}${endpointNote(h.lastEndpoint)}`,
    };
  }
  const status = h.lastErrorStatus ? `HTTP ${h.lastErrorStatus}, ` : "";
  return {
    tone: h.lastErrorStatus === 429 ? "warn" : "danger",
    text: `Failing, ${status}${h.lastError ?? "unknown error"}, ${timeAgo(h.lastErrorMs)}`,
  };
}

// --- page ---------------------------------------------------------------------

export default function Dashboard() {
  const { me } = useAuth();
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

  const activeConnections = (connections ?? []).filter((connection) => connection.status === "active");
  const needsAttention = (connections ?? []).filter(
    (connection) => connection.status !== "active" || connection.health?.status === "error",
  );
  const availableFamilies = new Set(
    Object.values(quotas).flatMap((quota) => quota.snapshot?.families.map((family) => family.id) ?? []),
  ).size;
  const displayName = me?.user.displayName || me?.user.email.split("@")[0] || "there";
  const firstName = displayName.split(/\s+/)[0];
  const requestCount = usage?.totals.requests ?? 0;
  const planUsage = usage?.entitlement;
  const errorRate = usage && usage.totals.requests ? Math.round((usage.totals.errors / usage.totals.requests) * 100) : 0;

  const refreshWorkspace = async () => {
    await Promise.all([
      loadConnections(),
      loadUsage(),
      ...activeConnections.map((connection) => loadQuota(connection.id, true)),
    ]);
  };

  return (
    <div className="dashboard-page rise-in space-y-5 sm:space-y-6">
      <section className="dashboard-hero overflow-hidden rounded-[2rem] p-5 sm:p-7 lg:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-accent">
              <span className="live-dot h-1.5 w-1.5" /> Ohshi command center
            </div>
            <p className="mt-4 text-sm font-semibold text-ink-dim">Good to see you, {firstName}.</p>
            <h1 className="dashboard-title mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Build, test and ship with your AI stack.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-dim sm:text-[15px]">
              Your models, conversations and gateway controls in one focused workspace — always on the plans you already own.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app" className="dashboard-primary-action">
              <MessageSquare className="h-4 w-4" /> New chat <ArrowRight className="h-4 w-4" />
            </Link>
            <Button tone="ghost" onClick={() => setConnectOpen(true)}>
              <Plug className="h-4 w-4" /> Connect
            </Button>
            <Button tone="ghost" onClick={() => void refreshWorkspace()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>
      </section>

      {flash && (
        <Notice tone={flash.tone} onClose={() => setFlash(null)}>
          {flash.text}
        </Notice>
      )}
      {loadError && <Notice tone="danger">{loadError}</Notice>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OverviewStat
          icon={Plug}
          label="Model connections"
          value={connections === null ? "—" : `${activeConnections.length}/${connections.length}`}
          detail={connections === null ? "Checking status" : activeConnections.length ? "Ready to use" : "Connect an account"}
          tone={activeConnections.length ? "ok" : "accent"}
        />
        <OverviewStat
          icon={CircleGauge}
          label="Available families"
          value={availableFamilies || (activeConnections.length ? "…" : "0")}
          detail={availableFamilies ? "Across your plan" : activeConnections.length ? "Reading quota" : "After you connect"}
          tone="accent"
        />
        <OverviewStat
          icon={Activity}
          label="Plan requests"
          value={planUsage ? `${formatNumber(planUsage.requestsUsed)}/${formatNumber(planUsage.requestLimit)}` : "…"}
          detail={planUsage ? `${planUsage.label} plan · monthly` : "Checking your plan"}
          tone="violet"
        />
        <OverviewStat
          icon={needsAttention.length ? TriangleAlert : CheckCircle2}
          label="Workspace health"
          value={needsAttention.length ? `${needsAttention.length} issue${needsAttention.length > 1 ? "s" : ""}` : "Healthy"}
          detail={needsAttention.length ? "Action recommended" : usage && requestCount ? `${errorRate}% gateway errors` : "Ready for your first run"}
          tone={needsAttention.length ? "warn" : "ok"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="glass dashboard-focus-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <WandSparkles className="h-4 w-4 text-accent" />
                <h2 className="text-base font-bold tracking-tight">Pick up where you left off</h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">The next useful move, based on the state of your workspace.</p>
            </div>
            {needsAttention.length > 0 && <Badge tone="warn">Needs attention</Badge>}
          </div>
          {connections === null ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : activeConnections.length === 0 ? (
            <NextMove
              to="/app/accounts"
              icon={Plug}
              title="Connect the plan that powers your models"
              copy="Add a Google account once, then access its supported models from chat and the API gateway."
              action="Connect a model account"
              onClick={() => setConnectOpen(true)}
            />
          ) : needsAttention.length > 0 ? (
            <NextMove
              to="#connections"
              icon={TriangleAlert}
              title="A connection needs a quick check"
              copy="Run a health test or reconnect it before your agents hit a failed request."
              action="Review connections"
            />
          ) : requestCount === 0 ? (
            <NextMove
              to="/app"
              icon={Sparkles}
              title="Start your first AI session"
              copy="Open chat to explore the models on your default connection, then keep the useful threads in history."
              action="Open new chat"
            />
          ) : (
            <NextMove
              to="/app/keys"
              icon={KeyRound}
              title="Put Ohshi to work outside this tab"
              copy="Create an API key and point your agent or application at the OpenAI-compatible gateway."
              action="Manage API keys"
            />
          )}
        </div>

        <div className="glass p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <h2 className="text-base font-bold tracking-tight">Quick actions</h2>
          </div>
          <div className="mt-3 grid gap-2">
            <ActionLink to="/app" icon={MessageSquare} title="Start a chat" copy="Explore with the default model" />
            <ActionLink to="/app/keys" icon={KeyRound} title="Create an API key" copy="Use Ohshi from your own agent" />
            <ActionLink to="/app/docs" icon={BookOpen} title="View API recipes" copy="Copy a working integration" />
          </div>
        </div>
      </section>

      <section id="connections" className="scroll-mt-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-ink-dim" />
              <h2 className="text-lg font-bold tracking-tight">Model connections</h2>
            </div>
            <p className="mt-1 text-xs text-ink-dim">Connection health, quota and default routing — all in one place.</p>
          </div>
          {connections && connections.length > 0 && (
            <Button size="sm" tone="ghost" onClick={() => setConnectOpen(true)}>
              <Plug className="h-3.5 w-3.5" /> Add connection
            </Button>
          )}
        </div>

        {connections === null ? (
          <Card>
            <Spinner label="Checking your model connections…" />
          </Card>
        ) : connections.length === 0 ? (
          <Card>
            <EmptyState
              title="Your AI workspace is ready for a model connection"
              hint="Sign in with the Google account whose plan you want to use. You’ll get live health and quota visibility here once it is connected."
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
      </section>

      <UsageSection usage={usage} />

      <ConnectGoogleModal open={connectOpen} onClose={() => setConnectOpen(false)} onDone={onConnected} />
    </div>
  );
}

function OverviewStat(props: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone: Tone;
}) {
  const Icon = props.icon;
  const iconTone = {
    accent: "bg-accent-soft text-accent",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    violet: "bg-violet-soft text-violet",
    dim: "bg-ink/[0.08] text-ink-dim",
  }[props.tone];

  return (
    <div className="glass dashboard-stat min-w-0 p-3.5 sm:p-4">
      <span className={`grid h-8 w-8 place-items-center rounded-xl ${iconTone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-ink-dim">{props.label}</p>
      <p className="mt-1 truncate text-xl font-extrabold tracking-tight sm:text-2xl">{props.value}</p>
      <p className="mt-0.5 truncate text-[11px] text-ink-dim">{props.detail}</p>
    </div>
  );
}

function NextMove(props: {
  to: string;
  icon: LucideIcon;
  title: string;
  copy: string;
  action: string;
  onClick?: () => void;
}) {
  const Icon = props.icon;
  return (
    <Link to={props.to} onClick={props.onClick} className="dashboard-next-move mt-5 flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-accent-ink shadow-sm">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{props.title}</span>
        <span className="mt-1 block max-w-xl text-xs leading-relaxed text-ink-dim">{props.copy}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-accent">
        {props.action} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function ActionLink(props: { to: string; icon: LucideIcon; title: string; copy: string }) {
  const Icon = props.icon;
  return (
    <Link to={props.to} className="dashboard-action-row flex items-center gap-3 rounded-2xl p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink/[0.06] text-ink-dim">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">{props.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-ink-dim">{props.copy}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-dim" />
    </Link>
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
                  <Badge tone="danger">Connected, not answering</Badge>
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
                  ? `Test passed, “${test.reply}” from ${test.model} via ${test.endpointLabel} in ${(test.latencyMs / 1000).toFixed(1)}s`
                  : `Test failed, ${test.error}${test.tried?.length ? ` (tried ${test.tried.join(", ")})` : ""}`}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-dim">
              Connected {timeAgo(c.connectedMs)}, project {c.projectId || "pending"}
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
              ? `Live from Google, ${snapshot.endpointLabel} endpoint, ${timeAgo(snapshot.fetchedMs)}${
                  snapshot.cached ? ", cached" : ""
                }${exhaustedCount ? `, ${exhaustedCount} model${exhaustedCount > 1 ? "s" : ""} out of quota` : ""}`
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
              <div key={i} className="rounded-xl bg-ink/[0.03] px-3 py-2.5">
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
    <div className="rounded-xl bg-ink/[0.03] px-3 py-2.5 transition-colors duration-300 hover:bg-ink/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Logo className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
          <span className="truncate text-[12.5px] font-semibold">
            {f.known ? f.label : (f.variants[0]?.displayName ?? f.id)}
          </span>
        </span>
        <span className={`shrink-0 text-[11px] font-semibold ${toneCls}`}>
          {f.remainingPercent === null ? "Unknown" : f.exhausted ? "out of quota" : `${f.remainingPercent}%`}
          {reset && <span className="ml-1 font-medium text-ink-dim">{reset}</span>}
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
              title={`${v.id}${v.resetMs ? `, resets ${countdown(v.resetMs, props.now)}` : ""}`}
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                v.exhausted ? "bg-danger-soft text-danger line-through" : "bg-ink/[0.06] text-ink-dim"
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
              sub={`${formatNumber(u.totals.promptTokens)} in, ${formatNumber(u.totals.completionTokens)} out`}
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
                hint="Start a chat, or create an API key and point your agent at /v1. Requests show up here as they happen."
                action={
                  <Link to="/app">
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
                          {timeAgo(r.createdMs)}, {(r.latencyMs / 1000).toFixed(1)}s
                          {r.streamed ? ", streamed" : ""}
                          {r.status !== "ok" && r.error ? `, ${r.error}` : ""}
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
