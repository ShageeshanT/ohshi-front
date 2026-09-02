/**
 * Dashboard — model sources (Gemini API keys, Google accounts), whether they
 * actually answer, live remaining quota per model, the optional connector, and
 * what your agents spent through the gateway.
 *
 * Data:
 *   GET  /api/gemini/keys                            -> {keys, route, studioUrl, maxKeys} (see GeminiKeysCard)
 *   GET  /api/google/connections                     -> {connections, redirectMode, endpoints}
 *   GET  /api/google/connections/:id/quota[?force=1] -> QuotaSnapshot (or 502 {error, stale})
 *   POST /api/google/connections/:id/test            -> {ok, latencyMs, endpointLabel, error, health}
 *   POST /api/google/connections/:id/execute-mode    -> {ok, connection}   cloud | prefer_local
 *   GET  /api/runner                                 -> RunnerStatus (the connector, see ConnectorCard)
 *   GET  /api/usage/summary?days=30                  -> totals / byModel / series / recent
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleGauge,
  ExternalLink,
  KeyRound,
  Laptop,
  MessageSquare,
  Plug,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import ConnectGoogleModal from "../components/ConnectGoogleModal";
import ConnectorCard, { type RunnerStatus } from "../components/ConnectorCard";
import GeminiKeysCard, { type GeminiKeysPayload } from "../components/GeminiKeysCard";
import { GeminiLogo, GoogleLogo, vendorLogo } from "../components/logos";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  Progress,
  SectionTitle,
  Skeleton,
  Spinner,
  Stat,
  Toggle,
  quotaTone,
  toneTextClass,
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

type ExecuteMode = "cloud" | "prefer_local";

interface Connection {
  id: string;
  email: string;
  projectId: string;
  endpoint: string;
  tier: string;
  status: "active" | "needs_reconnect" | "revoked";
  isDefault: boolean;
  /** Where this account's model calls run: Ohshi's servers, or the user's connector when online. */
  executeMode: ExecuteMode;
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

/** Where this account's calls go right now, in one line under the switch. */
function executionLine(c: Connection, runner: RunnerStatus | null): { tone: Tone; text: string } {
  if (c.executeMode !== "prefer_local") return { tone: "dim", text: "Calls run on Ohshi's servers." };
  if (!runner) return { tone: "dim", text: "Checking the connector…" };
  if (runner.online) {
    return { tone: "ok", text: `Calls leave from ${runner.hostname ?? "your machine"} while the connector is up.` };
  }
  const hasToken = runner.tokens.some((t) => t.revokedMs === null);
  return {
    tone: "warn",
    text: hasToken
      ? "Connector offline, so calls run on Ohshi's servers until it is back."
      : "No connector is set up yet, so calls run on Ohshi's servers. Create a token below.",
  };
}

// --- page ---------------------------------------------------------------------

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Record<string, QuotaState>>({});
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [runner, setRunner] = useState<RunnerStatus | null>(null);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [gemini, setGemini] = useState<GeminiKeysPayload | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
      /* the sources are the important part */
    }
  }, []);

  const loadRunner = useCallback(async () => {
    try {
      setRunner(await get<RunnerStatus>("/api/runner"));
      setRunnerError(null);
    } catch (e) {
      setRunnerError(friendly(e, "Couldn't read the connector status."));
    }
  }, []);

  // Keys and the route are local rows (no Google call), cheap to re-read.
  const loadGemini = useCallback(async () => {
    try {
      setGemini(await get<GeminiKeysPayload>("/api/gemini/keys"));
      setGeminiError(null);
    } catch (e) {
      setGeminiError(friendly(e, "Couldn't read your Gemini API keys."));
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

  // Health rows are local: once a minute is plenty. poll() pauses while the tab is hidden.
  useEffect(() => poll(loadConnections, 60_000), [loadConnections]);
  useEffect(() => poll(loadGemini, 60_000), [loadGemini]);
  useEffect(() => poll(loadUsage, 60_000), [loadUsage]);
  // Online / last seen changes fast when a laptop wakes.
  useEffect(() => poll(loadRunner, 15_000), [loadRunner]);

  const connectionIds = useMemo(
    () =>
      (connections ?? [])
        .filter((c) => c.status === "active")
        .map((c) => c.id)
        .join(","),
    [connections],
  );
  // Quota is a real call to Google per account: every 15 minutes, spread by up
  // to 15% so open tabs do not all ask at once. Refresh is the manual override.
  useEffect(() => {
    if (!connectionIds) return;
    const ids = connectionIds.split(",");
    return poll(
      async () => {
        await Promise.all(ids.map((id) => loadQuota(id)));
      },
      15 * 60_000,
      0.15,
    );
  }, [connectionIds, loadQuota]);

  const onConnected = (email: string) => {
    setConnectOpen(false);
    setFlash({ tone: "ok", text: `Connected ${email}.` });
    void loadConnections();
    void loadGemini();
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
      await Promise.all([loadConnections(), loadGemini()]);
    } catch (e) {
      setFlash({ tone: "danger", text: friendly(e) });
    }
  };

  const makeDefault = async (c: Connection) => {
    try {
      await post(`/api/google/connections/${c.id}/default`);
      setFlash({ tone: "ok", text: `Chat and /v1 now run on ${c.email} (Beta).` });
      await Promise.all([loadConnections(), loadGemini()]);
    } catch (e) {
      setFlash({ tone: "danger", text: friendly(e) });
    }
  };

  const setExecuteMode = async (c: Connection, mode: ExecuteMode) => {
    // Flip at once; the server's row (with its health note) replaces it when it answers.
    setConnections((list) => list?.map((x) => (x.id === c.id ? { ...x, executeMode: mode } : x)) ?? list);
    try {
      const { connection } = await post<{ connection: Connection }>(
        `/api/google/connections/${c.id}/execute-mode`,
        { executeMode: mode },
      );
      setConnections((list) => list?.map((x) => (x.id === c.id ? connection : x)) ?? list);
      void loadQuota(c.id, true);
    } catch (e) {
      setFlash({ tone: "danger", text: friendly(e) });
      void loadConnections();
    }
  };

  const activeConnections = (connections ?? []).filter((connection) => connection.status === "active");
  const preferLocalCount = activeConnections.filter((connection) => connection.executeMode === "prefer_local").length;
  const keys = gemini?.keys ?? [];
  const activeKeys = keys.filter((k) => k.status === "active");
  const route = gemini?.route ?? null;
  const studioUrl = gemini?.studioUrl ?? "https://aistudio.google.com/apikey";
  const sourcesKnown = connections !== null && gemini !== null;
  const activeSources = activeConnections.length + activeKeys.length;
  const totalSources = (connections?.length ?? 0) + keys.length;
  const needsAttention =
    (connections ?? []).filter((c) => c.status !== "active" || c.health?.status === "error").length +
    keys.filter((k) => k.status !== "active" || k.health?.status === "error").length;
  const availableFamilies = new Set(
    Object.values(quotas).flatMap((quota) => quota.snapshot?.families.map((family) => family.id) ?? []),
  ).size;
  const requestCount = usage?.totals.requests ?? 0;
  const errorRate = usage && usage.totals.requests ? Math.round((usage.totals.errors / usage.totals.requests) * 100) : 0;

  const refreshWorkspace = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadConnections(),
        loadGemini(),
        loadUsage(),
        loadRunner(),
        ...activeConnections.map((connection) => loadQuota(connection.id, true)),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="rise-in space-y-7">
      <PageHeader
        title="Overview"
        description="Your model sources, live quota and what your agents used through the gateway."
        actions={
          <>
            <Button tone="ghost" busy={refreshing} onClick={() => void refreshWorkspace()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button tone="ghost" onClick={() => setConnectOpen(true)}>
              <GoogleLogo className="h-3.5 w-3.5" /> Connect Google
            </Button>
            <Button onClick={() => setAddKeyOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add key
            </Button>
          </>
        }
      />

      {flash && (
        <Notice tone={flash.tone} onClose={() => setFlash(null)}>
          {flash.text}
        </Notice>
      )}
      {loadError && <Notice tone="danger">{loadError}</Notice>}

      <div className="tiles grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Plug}
          label="Model sources"
          value={!sourcesKnown ? "—" : `${activeSources} / ${totalSources}`}
          sub={
            !sourcesKnown
              ? "Checking status"
              : route
                ? route.kind === "gemini_api"
                  ? `Route: Gemini key ${route.label}`
                  : `Route: ${route.label} (Beta)`
                : "Add a key or connect an account"
          }
        />
        <Stat
          icon={CircleGauge}
          label="Quota families"
          value={availableFamilies || (activeConnections.length ? "…" : "0")}
          sub={
            availableFamilies
              ? "Read live from Google"
              : activeConnections.length
                ? "Reading quota"
                : activeKeys.length
                  ? "API keys report no meter"
                  : "After you connect an account"
          }
        />
        <Stat
          icon={Activity}
          label="Gateway requests"
          value={usage ? formatNumber(requestCount) : "…"}
          sub={`Last ${usage?.windowDays ?? 30} days`}
        />
        <Stat
          icon={needsAttention ? TriangleAlert : CheckCircle2}
          label="Health"
          value={needsAttention ? `${needsAttention} issue${needsAttention > 1 ? "s" : ""}` : "Healthy"}
          sub={
            needsAttention
              ? "A source needs a check"
              : usage && requestCount
                ? `${errorRate}% gateway errors`
                : "Ready for your first run"
          }
          tone={needsAttention ? "warn" : undefined}
        />
      </div>

      {sourcesKnown && activeSources === 0 && (
        <GetStarted onAddKey={() => setAddKeyOpen(true)} onConnect={() => setConnectOpen(true)} />
      )}

      <section id="sources" className="scroll-mt-4 space-y-3">
        <SectionTitle
          icon={GeminiLogo}
          title="Gemini API keys"
          badge={
            <Badge tone="ok" dot>
              Live
            </Badge>
          }
          description="Your own key from Google AI Studio. Google bills the key, Ohshi routes chat and /v1 to it."
          aside={
            <div className="flex gap-2">
              <a href={studioUrl} target="_blank" rel="noreferrer" className="inline-flex">
                <Button size="sm" tone="ghost">
                  <ExternalLink className="h-3.5 w-3.5" /> Get a key
                </Button>
              </a>
              <Button size="sm" onClick={() => setAddKeyOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add key
              </Button>
            </div>
          }
        />
        <GeminiKeysCard
          payload={gemini}
          error={geminiError}
          addOpen={addKeyOpen}
          onAddOpen={setAddKeyOpen}
          onChanged={() => {
            void loadGemini();
            void loadConnections();
          }}
          onFlash={setFlash}
        />
      </section>

      <section id="connections" className="scroll-mt-4 space-y-3">
        <SectionTitle
          icon={GoogleLogo}
          title="Google accounts"
          badge={<Badge tone="violet">Beta</Badge>}
          description="Sign in with the account behind your Google AI plan. Health, live quota and routing in one place."
          aside={
            <Button size="sm" tone="ghost" onClick={() => setConnectOpen(true)}>
              <Plug className="h-3.5 w-3.5" /> Add account
            </Button>
          }
        />

        {connections === null ? (
          <Card>
            <Spinner label="Checking your Google accounts…" />
          </Card>
        ) : connections.length === 0 ? (
          <Card>
            <EmptyState
              title="No Google account connected"
              hint="Optional, and in Beta. Sign in with the Google account whose plan you want to use and paste back the code. Live health and quota show up here once it is connected."
              action={
                <Button tone="ghost" onClick={() => setConnectOpen(true)} arrow>
                  <Plug className="h-3.5 w-3.5" /> Connect account
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {connections.map((c) => (
              <ConnectionCard
                key={c.id}
                connection={c}
                quota={quotas[c.id] ?? { snapshot: null, error: null, loading: true }}
                runner={runner}
                canMakeDefault={!c.isDefault && (connections.length > 1 || route?.kind === "gemini_api")}
                onRefreshQuota={() => loadQuota(c.id, true)}
                onDisconnect={() => disconnect(c)}
                onMakeDefault={() => makeDefault(c)}
                onReconnect={() => setConnectOpen(true)}
                onExecuteMode={(mode) => void setExecuteMode(c, mode)}
                onTested={() => {
                  void loadConnections();
                  void loadQuota(c.id, true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section id="connector" className="scroll-mt-4 space-y-3">
        <SectionTitle
          icon={Laptop}
          title="Connector"
          badge={<Badge tone="violet">Beta</Badge>}
          description="Optional. Make your model calls from your own computer instead of Ohshi's servers."
        />
        <ConnectorCard
          status={runner}
          error={runnerError}
          preferLocalCount={preferLocalCount}
          onChanged={() => void loadRunner()}
        />
      </section>

      <UsageSection usage={usage} />

      <ConnectGoogleModal open={connectOpen} onClose={() => setConnectOpen(false)} onDone={onConnected} />
    </div>
  );
}

/** Three steps, shown only while nothing is connected yet. */
function GetStarted(props: { onAddKey: () => void; onConnect: () => void }) {
  const steps: { n: string; title: string; text: string; action: ReactNode }[] = [
    {
      n: "1",
      title: "Add a model source",
      text: "Paste a Gemini API key from Google AI Studio, or connect a Google account in Beta.",
      action: (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={props.onAddKey}>
            <KeyRound className="h-3.5 w-3.5" /> Add a key
          </Button>
          <Button size="sm" tone="ghost" onClick={props.onConnect}>
            Connect Google
          </Button>
        </div>
      ),
    },
    {
      n: "2",
      title: "Try it in chat",
      text: "Pick a model in the composer and send a message. Replies stream on your own key or plan.",
      action: (
        <Link to="/app" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
          <MessageSquare className="h-3.5 w-3.5" /> Open chat <ArrowRight className="h-3 w-3" />
        </Link>
      ),
    },
    {
      n: "3",
      title: "Point your code at /v1",
      text: "Create an ohs_ key and use it with any OpenAI compatible client. The docs have a snippet per model.",
      action: (
        <Link to="/app/keys" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
          <KeyRound className="h-3.5 w-3.5" /> Create an API key <ArrowRight className="h-3 w-3" />
        </Link>
      ),
    },
  ];
  return (
    <div className="tiles sm:grid-cols-3">
      {steps.map((s) => (
        <div key={s.n} className="flex flex-col gap-2.5 px-4 py-4">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[11px] font-semibold text-panel">{s.n}</span>
          <div>
            <p className="text-[13px] font-semibold">{s.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{s.text}</p>
          </div>
          <div className="mt-auto pt-1">{s.action}</div>
        </div>
      ))}
    </div>
  );
}

// --- one connected account -------------------------------------------------------

function ConnectionCard(props: {
  connection: Connection;
  quota: QuotaState;
  runner: RunnerStatus | null;
  /** Hidden for the only account unless a Gemini key currently holds the route. */
  canMakeDefault: boolean;
  onRefreshQuota: () => void;
  onDisconnect: () => void;
  onMakeDefault: () => void;
  onReconnect: () => void;
  onExecuteMode: (mode: ExecuteMode) => void;
  onTested: () => void;
}) {
  const c = props.connection;
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const line = healthLine(c, testing);
  const connected = c.status === "active";
  const preferLocal = c.executeMode === "prefer_local";
  const execution = executionLine(c, props.runner);
  // The backend sets this exact sentence (and only this) when a prefer_local
  // call had to run on Ohshi's servers; health stays green, so say it quietly.
  const fellBack =
    preferLocal && !!props.runner && !!c.health?.lastError && c.health.lastError === props.runner.fallbackMessage;

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
    <Card flush className={c.isDefault ? "ring-1 ring-accent/30" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-edge bg-panel">
            <GoogleLogo className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold">{c.email}</span>
              {c.isDefault && (
                <Badge tone="accent">
                  <Star className="h-3 w-3" /> Default
                </Badge>
              )}
              {connected ? (
                c.health?.status === "error" ? (
                  <Badge tone="danger" dot>
                    Not answering
                  </Badge>
                ) : (
                  <Badge tone="ok" dot>
                    Connected
                  </Badge>
                )
              ) : (
                <Badge tone="danger" dot>
                  Needs reconnect
                </Badge>
              )}
              {c.tier && <Badge>{c.tier === "free" ? "Code Assist free tier" : `${c.tier} tier`}</Badge>}
            </div>
            <p className={`mt-1 text-[12px] ${toneTextClass(line.tone)}`}>{line.text}</p>
            {test && !testing && (
              <p className={`mt-0.5 text-[12px] ${test.ok ? "text-ok" : "text-danger"}`}>
                {test.ok
                  ? `Test passed, “${test.reply}” from ${test.model} via ${test.endpointLabel} in ${(test.latencyMs / 1000).toFixed(1)}s`
                  : `Test failed, ${test.error}${test.tried?.length ? ` (tried ${test.tried.join(", ")})` : ""}`}
              </p>
            )}
            <p className="mt-0.5 text-[12px] text-ink-dim">
              Connected {timeAgo(c.connectedMs)}, project {c.projectId || "pending"}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
          {connected ? (
            <Button size="sm" tone="ghost" busy={testing} onClick={runTest}>
              <Zap className="h-3.5 w-3.5" /> Test
            </Button>
          ) : (
            <Button size="sm" onClick={props.onReconnect}>
              <Plug className="h-3.5 w-3.5" /> Reconnect
            </Button>
          )}
          {props.canMakeDefault && connected && (
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge bg-surface px-4 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Toggle
              checked={preferLocal}
              onChange={(next) => props.onExecuteMode(next ? "prefer_local" : "cloud")}
              label="Run on my machine"
            />
            <span className={`text-[12px] ${toneTextClass(execution.tone)}`}>{execution.text}</span>
            {fellBack && (
              <span className="text-[12px] text-warn">
                The last call ran on Ohshi's servers because the connector was offline.
              </span>
            )}
          </div>
          <a href="#connector" className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink-dim hover:text-ink">
            <Laptop className="h-3.5 w-3.5" /> Connector
          </a>
        </div>
      )}

      {connected && (
        <div className="border-t border-edge px-4 py-3.5">
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
          <h3 className="text-[12.5px] font-semibold">Remaining quota</h3>
          <p className="text-[12px] text-ink-dim">
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
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-edge px-3 py-2.5">
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="mt-2.5 h-1.5 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No quota reading yet" hint="Hit Refresh to ask Google again." />
        )
      ) : snapshot.families.length === 0 ? (
        <EmptyState title="Google listed no models for this account" hint="The plan may not include Antigravity yet." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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

  return (
    <div className="rounded-lg border border-edge px-3 py-2.5 transition-colors hover:border-edge-strong">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Logo className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
          <span className="truncate text-[12.5px] font-medium">{f.known ? f.label : (f.variants[0]?.displayName ?? f.id)}</span>
        </span>
        <span className={`tnum shrink-0 text-[12px] font-medium ${toneTextClass(tone)}`}>
          {f.remainingPercent === null ? "Unknown" : f.exhausted ? "out of quota" : `${f.remainingPercent}%`}
          {reset && <span className="ml-1 font-normal text-ink-dim">{reset}</span>}
        </span>
      </div>
      <div className="mt-2">
        <Progress percent={f.remainingPercent} tone={tone} className="h-1" />
      </div>
      {f.variants.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {f.variants.map((v) => (
            <span
              key={v.id}
              title={`${v.id}${v.resetMs ? `, resets ${countdown(v.resetMs, props.now)}` : ""}`}
              className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${
                v.exhausted ? "bg-danger-soft text-danger line-through" : "bg-ink/[0.05] text-ink-dim"
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
    <section className="space-y-3">
      <SectionTitle
        icon={Activity}
        title="Usage"
        description={`What your agents used through the gateway in the last ${u?.windowDays ?? 30} days.`}
      />
      {!u ? (
        <Card>
          <Spinner label="Loading usage…" />
        </Card>
      ) : (
        <>
          <div className="tiles grid-cols-2 md:grid-cols-4">
            <Stat label="Requests" value={formatNumber(u.totals.requests)} />
            <Stat
              label="Tokens"
              value={formatNumber(u.totals.totalTokens)}
              sub={`${formatNumber(u.totals.promptTokens)} in, ${formatNumber(u.totals.completionTokens)} out`}
            />
            <Stat label="Errors" value={formatNumber(u.totals.errors)} tone={u.totals.errors ? "danger" : undefined} />
            <Stat label="Models used" value={u.byModel.length} />
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
            <div className="grid gap-3 lg:grid-cols-2">
              <Card title="By model" flush>
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th className="num">Calls</th>
                        <th className="num">Tokens</th>
                        <th className="num">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.byModel.map((row) => (
                        <tr key={row.model}>
                          <td className="mono text-[12px]">{row.model}</td>
                          <td className="num">{formatNumber(row.requests)}</td>
                          <td className="num">{formatNumber(row.totalTokens)}</td>
                          <td className={`num ${row.errors ? "font-medium text-danger" : "text-ink-dim"}`}>{row.errors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Recent calls" flush>
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>When</th>
                        <th className="num">Latency</th>
                        <th className="num">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.recent.slice(0, 10).map((r) => (
                        <tr key={r.id}>
                          <td className="mono max-w-[14rem] truncate text-[12px]" title={r.apiModel}>
                            {r.apiModel}
                          </td>
                          <td className="whitespace-nowrap text-ink-dim">
                            {timeAgo(r.createdMs)}
                            {r.streamed ? ", streamed" : ""}
                          </td>
                          <td className="num text-ink-dim">{(r.latencyMs / 1000).toFixed(1)}s</td>
                          <td className="num">
                            {r.status === "ok" ? (
                              `${formatNumber(r.totalTokens)} tok`
                            ) : (
                              <Badge tone="danger" className="ml-auto" >
                                {r.httpStatus ?? "error"}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </section>
  );
}
