/**
 * The workspace's data, shared by the Overview, Models, Usage and Connected
 * accounts pages: connections, Gemini keys, the connector, the usage ledger
 * and per-account quota. Each hook owns its own polling (the same cadence the
 * dashboard always used) so a page only pays for what it shows.
 *
 * Shapes match ohshi/db/models.py, ohshi/google/quota.py and
 * ohshi/usage/router.py. Fields that only the billing branch of the backend
 * fills in are optional.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GeminiKeysPayload } from "../components/GeminiKeysCard";
import type { RunnerStatus } from "../components/ConnectorCard";
import type { Tone } from "../components/ui";
import { ApiError, friendly, get, poll, timeAgo } from "./api";

export interface Health {
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

export type ExecuteMode = "cloud" | "prefer_local";

export interface Connection {
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
  /** Above the plan's connection limit (billing backend only). */
  locked?: boolean;
}

export interface ConnectionsPayload {
  connections: Connection[];
  redirectMode: "paste" | "callback";
  endpoints: { url: string; label: string }[];
}

export interface ModelQuota {
  id: string;
  displayName: string;
  familyId: string;
  effort: string;
  known: boolean;
  remainingPercent: number | null;
  resetMs: number | null;
  exhausted: boolean;
}

export interface FamilyQuota {
  id: string;
  label: string;
  vendor: string;
  known: boolean;
  remainingPercent: number | null;
  exhausted: boolean;
  resetMs: number | null;
  variants: ModelQuota[];
}

export interface QuotaSnapshot {
  connectionId: string;
  fetchedMs: number;
  endpointLabel: string;
  cached: boolean;
  modelCount: number;
  summary: { exhausted: string[]; nextResetMs: number | null; lowest: ModelQuota | null };
  families: FamilyQuota[];
}

export interface QuotaState {
  snapshot: QuotaSnapshot | null;
  error: string | null;
  loading: boolean;
}

/** Ohshi's own monthly allowance (billing backend only). */
export interface Entitlement {
  plan: string;
  label: string;
  period: string;
  requestLimit: number;
  requestsUsed: number;
  requestsRemaining: number;
}

export interface UsageSummary {
  windowDays: number;
  totals: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    errors: number;
  };
  entitlement?: Entitlement;
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

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  endpointLabel?: string;
  reply?: string;
  error?: string;
  tried?: string[];
}

// --- plain language ---------------------------------------------------------------

function endpointNote(endpoint?: string | null): string {
  if (!endpoint) return "";
  if (endpoint.includes("daily-")) return ", via Google's daily endpoint";
  if (endpoint.includes("autopush-")) return ", via Google's autopush endpoint";
  return "";
}

/** One plain language line per account: working, failing or untested. */
export function healthLine(c: Connection, testing: boolean): { tone: Tone; text: string } {
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
export function executionLine(c: Connection, runner: RunnerStatus | null): { tone: Tone; text: string } {
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
      : "No connector is set up yet, so calls run on Ohshi's servers. Create a token on the Connected accounts page.",
  };
}

// --- hooks ------------------------------------------------------------------------

/** Google accounts. Health rows are local: once a minute is plenty; poll() pauses while the tab is hidden. */
export function useConnections(pollMs = 60_000) {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const data = await get<ConnectionsPayload>("/api/google/connections");
      setConnections(data.connections);
      setError(null);
    } catch (e) {
      setError(friendly(e));
    }
  }, []);
  useEffect(() => poll(reload, pollMs), [reload, pollMs]);
  return { connections, setConnections, error, reload };
}

/** Gemini API keys and the current route. Local rows, cheap to re-read. */
export function useGeminiKeys(pollMs = 60_000) {
  const [gemini, setGemini] = useState<GeminiKeysPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setGemini(await get<GeminiKeysPayload>("/api/gemini/keys"));
      setError(null);
    } catch (e) {
      setError(friendly(e, "Couldn't read your Gemini API keys."));
    }
  }, []);
  useEffect(() => poll(reload, pollMs), [reload, pollMs]);
  return { gemini, error, reload };
}

/** The gateway ledger. */
export function useUsage(days = 30, pollMs = 60_000) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const reload = useCallback(async () => {
    try {
      setUsage(await get<UsageSummary>(`/api/usage/summary?days=${days}`));
    } catch {
      /* the page shows what it has */
    }
  }, [days]);
  useEffect(() => poll(reload, pollMs), [reload, pollMs]);
  return { usage, reload };
}

/** The connector. Online / last seen changes fast when a laptop wakes. */
export function useRunner(pollMs = 15_000) {
  const [runner, setRunner] = useState<RunnerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setRunner(await get<RunnerStatus>("/api/runner"));
      setError(null);
    } catch (e) {
      setError(friendly(e, "Couldn't read the connector status."));
    }
  }, []);
  useEffect(() => poll(reload, pollMs), [reload, pollMs]);
  return { runner, error, reload };
}

/**
 * Live quota per active account. Quota is a real call to Google per account:
 * every 15 minutes, spread by up to 15% so open tabs do not all ask at once.
 * `loadQuota(id, true)` is the manual override.
 */
export function useQuotas(connections: Connection[] | null) {
  const [quotas, setQuotas] = useState<Record<string, QuotaState>>({});

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

  const forget = useCallback((id: string) => {
    setQuotas((q) => {
      const next = { ...q };
      delete next[id];
      return next;
    });
  }, []);

  const activeIds = useMemo(
    () =>
      (connections ?? [])
        .filter((c) => c.status === "active")
        .map((c) => c.id)
        .join(","),
    [connections],
  );

  useEffect(() => {
    if (!activeIds) return;
    const ids = activeIds.split(",");
    return poll(
      async () => {
        await Promise.all(ids.map((id) => loadQuota(id)));
      },
      15 * 60_000,
      0.15,
    );
  }, [activeIds, loadQuota]);

  return { quotas, loadQuota, forget };
}

export const quotaFor = (quotas: Record<string, QuotaState>, id: string): QuotaState =>
  quotas[id] ?? { snapshot: null, error: null, loading: true };
