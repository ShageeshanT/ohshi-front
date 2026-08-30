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

export interface ChatModelsPayload {
  connected: boolean;
  connectionId: string | null;
  email: string | null;
  quotaAvailable: boolean;
  error: string | null;
  fetchedMs: number | null;
  endpointLabel: string | null;
  default: string;
  families: ModelFamily[];
}

export type ChatEvent =
  | { type: "user"; message: ChatMessage; chat: ChatSummary }
  | { type: "delta"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "done"; message: ChatMessage; chat: ChatSummary; usage: Record<string, number> }
  | { type: "error"; message: string; code?: string; status?: number };

/** Shown first in the picker; everything else hides under "Other models". */
export const POPULAR_FAMILIES = [
  "gemini-3.6-flash",
  "gemini-3.1-pro",
  "claude-sonnet-4-6",
  "gpt-oss-120b-medium",
];

/** Split a model list into the famous few and the long tail (order preserved). */
export function splitPopular<T extends { id: string }>(families: T[]): { popular: T[]; other: T[] } {
  const rank = new Map(POPULAR_FAMILIES.map((id, i) => [id, i]));
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
