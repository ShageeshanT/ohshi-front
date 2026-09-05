/**
 * The admin surface's wire shapes and fetchers. Everything here is behind
 * `me.user.isAdmin`; the backend answers 403 to anyone else regardless.
 * Shapes match ohshi/admin/router.py.
 */

import { get, post } from "./api";

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  createdMs: number;
  authProvider: "clerk" | "password";
  isAdmin: boolean;
  isActive: boolean;
  bannedMs: number | null;
  banReason: string | null;
  plan: string;
  planLabel: string;
  subscriptionStatus: string | null;
  planRenewsMs: number | null;
  billingFlag: string | null;
  hasSubscription: boolean;
  requestsMonth: number;
  requestLimit: number;
  /** Ohshi's own models (ohs3 / ohs3-pro): replies today and this month against the plan's meter. */
  ohshiRequestsDay: number;
  ohshiDailyLimit: number;
  ohshiRequestsMonth: number;
  ohshiMonthlyLimit: number;
  requests30d: number;
  errors30d: number;
  tokens30d: number;
  lastRequestMs: number | null;
  lastSeenMs: number | null;
  sessions: number;
  connections: { google: number; chatgpt: number; deepseek: number; geminiKeys: number; deepseekKeys: number };
  apiKeys: number;
  chats: number;
}

export interface AdminOverview {
  users: {
    total: number;
    new7d: number;
    active7d: number;
    banned: number;
    flagged: number;
    paid: number;
    byPlan: Record<string, number>;
  };
  requests: { today: number; d7: number; d30: number; errors7d: number; errors30d: number };
  topModels: { model: string; requests: number; tokens: number }[];
  topUsers: { id: string; email: string; plan: string; isActive: boolean; requests7d: number; errors7d: number; tokens7d: number }[];
  recentSignups: { id: string; email: string; createdMs: number; plan: string; authProvider: string }[];
  billingEnabled: boolean;
}

export interface AdminUserList {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminSession {
  id: string;
  createdMs: number;
  lastSeenMs: number;
  expiresMs: number;
  ip: string;
  userAgent: string;
}

export interface AdminUsageRow {
  id: number;
  createdMs: number;
  model: string;
  apiModel: string;
  endpoint: string;
  via: "api key" | "chat";
  source: string;
  status: "ok" | "error";
  httpStatus: number | null;
  error: string;
  totalTokens: number;
  latencyMs: number;
}

export interface AdminBillingEvent {
  id: number;
  eventType: string;
  note: string;
  applied: boolean;
  resourceId: string | null;
  eventMs: number | null;
  receivedMs: number;
}

/** The connection dictionaries are the owners' own as_dict() views. */
export type Loose = Record<string, unknown>;

export interface AdminUserDetail {
  user: AdminUserRow;
  google: Loose[];
  chatgpt: Loose[];
  deepseek: Loose[];
  geminiKeys: Loose[];
  deepseekKeys: Loose[];
  apiKeys: { id: string; name: string; prefix: string; createdMs: number; lastUsedMs: number | null; revokedMs: number | null }[];
  sessions: AdminSession[];
  daily: { day: string; requests: number; errors: number; tokens: number }[];
  recentUsage: AdminUsageRow[];
  billingEvents: AdminBillingEvent[];
  subscriptionCancelled?: boolean;
  revokedKeys?: number;
}

export type UserStatusFilter = "all" | "active" | "banned" | "paid" | "flagged";
export type UserSort = "created" | "lastSeen" | "requests" | "email";

export const fetchOverview = () => get<AdminOverview>("/api/admin/overview");

export function fetchUsers(opts: { q?: string; status?: UserStatusFilter; sort?: UserSort; page?: number; pageSize?: number }) {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.status && opts.status !== "all") params.set("status", opts.status);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  const qs = params.toString();
  return get<AdminUserList>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

export const fetchUser = (id: string) => get<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}`);
export const banUser = (id: string, reason: string, cancelSubscription: boolean) =>
  post<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}/ban`, { reason, cancelSubscription });
export const unbanUser = (id: string) => post<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}/unban`);
export const revokeSessions = (id: string) => post<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}/sessions/revoke`);
export const revokeKeys = (id: string) => post<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}/keys/revoke`);
export const grantPlan = (id: string, plan: string) => post<AdminUserDetail>(`/api/admin/users/${encodeURIComponent(id)}/plan`, { plan });

export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : fallback;
}
export function bool(v: unknown): boolean {
  return v === true;
}
export function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
