/**
 * API client for the dashboard. Cookie sessions (same origin), JSON in/out.
 *
 * Every "/api" error is `{error: "message"}`; "/v1" errors are OpenAI-shaped
 * (`{error: {message, type, code}}`). Both are normalized into ApiError.
 */

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type AuthListener = () => void;
const authListeners = new Set<AuthListener>();

/** Fires when any request (outside /api/auth) comes back 401 — the session died. */
export function onAuthRequired(fn: AuthListener): () => void {
  authListeners.add(fn);
  return () => {
    authListeners.delete(fn);
  };
}

interface RequestInitLite {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, init: RequestInitLite = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const resp = await fetch(path, {
    method: init.method ?? "GET",
    headers: hasBody ? { "Content-Type": "application/json" } : {},
    body: hasBody ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    signal: init.signal,
  });
  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (resp.status === 401 && !path.startsWith("/api/auth/")) {
    authListeners.forEach((fn) => fn());
  }
  if (!resp.ok) {
    throw new ApiError(resp.status, extractMessage(data, resp.status), data);
  }
  return data as T;
}

function extractMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return `Request failed (${status})`;
}

export const get = <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body ?? {} });

/** POST that returns the raw streaming Response (Server-Sent Events). */
export async function streamPost(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const resp = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body ?? {}),
    credentials: "same-origin",
    signal,
  });
  if (resp.status === 401) authListeners.forEach((fn) => fn());
  if (!resp.ok) {
    let data: unknown = null;
    try {
      data = await resp.json();
    } catch {
      data = null;
    }
    throw new ApiError(resp.status, extractMessage(data, resp.status), data);
  }
  return resp;
}

/** Read `data: {json}` blocks from an SSE response until it ends or is aborted. */
export async function readSSE(
  resp: Response,
  onEvent: (event: Record<string, unknown>) => void,
): Promise<void> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handleBlock = (block: string) => {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as Record<string, unknown>);
      } catch {
        /* malformed event — skip */
      }
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf("\n\n")) >= 0) {
      handleBlock(buffer.slice(0, index));
      buffer = buffer.slice(index + 2);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleBlock(buffer);
}

/** Friendly error line for the UI. */
export function friendly(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof Error && e.name === "AbortError") return "";
  return fallback;
}

/** Poll helper: run now, then every `ms` while the tab is visible. */
export function poll(fn: () => void | Promise<void>, ms: number): () => void {
  let stopped = false;
  let running = false;
  let timer: number | undefined;

  const schedule = () => {
    if (stopped || document.hidden) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void run(), ms);
  };
  const run = async () => {
    if (stopped || running || document.hidden) return;
    running = true;
    try {
      await fn();
    } catch (error) {
      console.warn("refresh failed", error);
    } finally {
      running = false;
      schedule();
    }
  };
  const onVisibility = () => {
    if (document.hidden) window.clearTimeout(timer);
    else void run();
  };
  document.addEventListener("visibilitychange", onVisibility);
  void run();
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

// --- formatting ------------------------------------------------------------

export function timeAgo(ms?: number | null): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(ms).toLocaleDateString();
}

/** "in 2h 10m" / "in 35s" / "now" for a future epoch-ms; "" when unknown. */
export function countdown(ms?: number | null, now = Date.now()): string {
  if (!ms) return "";
  const diff = ms - now;
  if (diff <= 0) return "now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 48) return rem ? `in ${h}h ${rem}m` : `in ${h}h`;
  return `in ${Math.floor(h / 24)}d ${h % 24}h`;
}

export function formatNumber(n?: number | null): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 10_000) return `${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toLocaleString();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
