/** Types + helpers for the chat page (shapes match ohshi/chat/*). */

export interface ChatSummary {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  createdMs: number;
  updatedMs: number;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** A file sent with a user message (see ohshi/chat/attachments.py). */
export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "pdf" | "text" | "office";
  url: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  reasoning: string | null;
  model: string;
  endpoint: string;
  status: "complete" | "interrupted";
  usage: ChatUsage;
  latencyMs: number;
  createdMs: number;
  attachments?: Attachment[];
}

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** What the composer accepts; mirrors the backend's classify(). */
export const ATTACHMENT_ACCEPT =
  "image/*,.pdf,.pptx,.docx,.xlsx,.txt,.md,.csv,.json,.xml,.yaml,.yml,.toml,.py,.js,.ts,.tsx,.jsx,.html,.css,.sql,.sh,.log";

const OFFICE_EXT: Record<string, true> = { pptx: true, docx: true, xlsx: true };
const TEXT_EXT: Record<string, true> = {
  txt: true, md: true, csv: true, json: true, xml: true, yaml: true, yml: true, toml: true, py: true, js: true,
  ts: true, tsx: true, jsx: true, html: true, css: true, sql: true, sh: true, log: true,
};

/** The kind a file will be stored as, or null when the backend would refuse it. */
export function attachmentKind(file: { name: string; type: string }): Attachment["kind"] | null {
  const mime = (file.type || "").toLowerCase();
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (OFFICE_EXT[ext]) return "office";
  if (mime.startsWith("text/") || TEXT_EXT[ext] || mime === "application/json") return "text";
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ModelVariant {
  id: string;
  displayName: string;
  familyId: string;
  effort: string;
  known: boolean;
  remainingPercent: number | null;
  resetMs: number | null;
  exhausted: boolean;
}

export interface ModelFamily {
  id: string;
  label: string;
  vendor: string;
  known: boolean;
  remainingPercent: number | null;
  exhausted: boolean;
  resetMs: number | null;
  variants: ModelVariant[];
}

/** Which credential the picker's list came from. */
export type RouteKind = "gemini_api" | "deepseek_api" | "code_assist" | "chatgpt" | "deepseek_chat";

/** The pasted-key routes: the user's own key on a supported API (not Beta). */
export function isKeyRoute(kind: RouteKind | null | undefined): boolean {
  return kind === "gemini_api" || kind === "deepseek_api";
}

export interface ChatModelsPayload {
  connected: boolean;
  /** null when nothing usable is configured (the built-in list is shown). */
  route: RouteKind | null;
  /** The key's label, or the Google / ChatGPT account's email. */
  routeLabel: string | null;
  /** The account connectors (Google, ChatGPT) are Beta; the Gemini and DeepSeek API keys are not. */
  beta: boolean;
  /** The key id or the connection id behind the list. */
  connectionId: string | null;
  email: string | null;
  quotaAvailable: boolean;
  error: string | null;
  fetchedMs: number | null;
  endpointLabel: string | null;
  default: string;
  /** Ids to show first (key routes); null = use POPULAR_FAMILIES. */
  popular: string[] | null;
  families: ModelFamily[];
}

export type ChatEvent =
  | { type: "user"; message: ChatMessage; chat: ChatSummary }
  | { type: "delta"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "done"; message: ChatMessage; chat: ChatSummary; usage: Record<string, number>; route?: RouteKind }
  | { type: "error"; message: string; code?: string; status?: number };

/** Shown first in the picker; everything else hides under "Other models". */
export const POPULAR_FAMILIES = [
  "gemini-3.6-flash",
  "gemini-3.1-pro",
  "claude-sonnet-4-6",
  "gpt-oss-120b-medium",
];

/** Split a model list into the famous few and the long tail (order preserved).
 *  The backend names the top section on the Gemini API route; the Code Assist
 *  list falls back to POPULAR_FAMILIES. */
export function splitPopular<T extends { id: string }>(
  families: T[],
  popularIds: string[] | null = null,
): { popular: T[]; other: T[] } {
  const rank = new Map((popularIds ?? POPULAR_FAMILIES).map((id, i) => [id, i]));
  const popular = families
    .filter((f) => rank.has(f.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  return { popular, other: families.filter((f) => !rank.has(f.id)) };
}

export const MODEL_STORAGE_KEY = "ohshi.chat.model";

export function loadStoredModel(): string {
  try {
    return localStorage.getItem(MODEL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeModel(id: string): void {
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, id);
  } catch {
    /* private mode etc. */
  }
}

export function allVariantIds(models: ChatModelsPayload): Set<string> {
  return new Set(models.families.flatMap((f) => f.variants.map((v) => v.id)));
}

export function findVariant(
  models: ChatModelsPayload,
  id: string,
): { family: ModelFamily; variant: ModelVariant } | null {
  for (const family of models.families) {
    const variant = family.variants.find((v) => v.id === id);
    if (variant) return { family, variant };
  }
  return null;
}

export function effortLabel(effort: string): string {
  if (!effort) return "";
  return effort.charAt(0).toUpperCase() + effort.slice(1);
}

export function familyName(family: ModelFamily): string {
  return family.known ? family.label : (family.variants[0]?.displayName ?? family.id);
}

/** "Gemini 3.6 Flash, High" for the picker button and message footer. */
export function modelLabel(models: ChatModelsPayload | null, id: string): string {
  if (!id) return "Model";
  const hit = models ? findVariant(models, id) : null;
  if (!hit) return id;
  const effort = hit.variant.effort ? `, ${effortLabel(hit.variant.effort)}` : "";
  return `${familyName(hit.family)}${effort}`;
}

/** "Gemini API key ‘personal’" / "DeepSeek API key ‘work’" / "me@gmail.com (Beta)" /
 *  "me@openai.com (ChatGPT, Beta)" for the picker header and route pill. */
export function routeLabel(models: ChatModelsPayload | null): string {
  if (!models || !models.route) return "";
  if (models.route === "gemini_api") {
    return models.routeLabel ? `Gemini API key ‘${models.routeLabel}’` : "Gemini API key";
  }
  if (models.route === "deepseek_api") {
    return models.routeLabel ? `DeepSeek API key ‘${models.routeLabel}’` : "DeepSeek API key";
  }
  if (models.route === "chatgpt") {
    return `${models.email ?? models.routeLabel ?? "ChatGPT account"} (ChatGPT, Beta)`;
  }
  if (models.route === "deepseek_chat") {
    return `${models.email ?? models.routeLabel ?? "DeepSeek account"} (DeepSeek chat, Beta)`;
  }
  return `${models.email ?? models.routeLabel ?? "Google account"} (Beta)`;
}

const DAY_MS = 86_400_000;

/** History groups like Grok/ChatGPT: Today, Yesterday, Previous 7 days, Older. */
export function groupChatsByDate(chats: ChatSummary[]): { label: string; chats: ChatSummary[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets: { label: string; test: (ms: number) => boolean }[] = [
    { label: "Today", test: (ms) => ms >= startOfToday },
    { label: "Yesterday", test: (ms) => ms >= startOfToday - DAY_MS },
    { label: "Previous 7 days", test: (ms) => ms >= startOfToday - 7 * DAY_MS },
    { label: "Previous 30 days", test: (ms) => ms >= startOfToday - 30 * DAY_MS },
    { label: "Older", test: () => true },
  ];
  const groups = buckets.map((b) => ({ label: b.label, chats: [] as ChatSummary[] }));
  for (const chat of chats) {
    const index = buckets.findIndex((b) => b.test(chat.updatedMs));
    groups[index === -1 ? groups.length - 1 : index].chats.push(chat);
  }
  return groups.filter((g) => g.chats.length > 0);
}
