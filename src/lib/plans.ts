/**
 * Ohshi's own plans. The backend's billing branch serves the live matrix at
 * GET /api/billing/plans; this mirror paints the page instantly and stands in
 * when that route is not there yet, so a price or limit change on the server
 * shows up without an edit here.
 */

import { get } from "./api";

export interface PlanRow {
  code: string;
  label: string;
  priceUsd: number;
  monthlyRequestLimit: number;
  maxConnections: number;
  maxApiKeys: number;
  historyDays: number;
  perMinuteLimit: number;
  /** Ohshi's own models (OHS3, OHS3 Pro): replies per UTC day and per month. */
  ohshiDailyLimit?: number;
  ohshiMonthlyLimit?: number;
}

export const PLAN_FALLBACK: PlanRow[] = [
  { code: "free", label: "Free", priceUsd: 0, monthlyRequestLimit: 50, maxConnections: 1, maxApiKeys: 1, historyDays: 7, perMinuteLimit: 3, ohshiDailyLimit: 5, ohshiMonthlyLimit: 30 },
  { code: "plus", label: "Plus", priceUsd: 7, monthlyRequestLimit: 200, maxConnections: 2, maxApiKeys: 3, historyDays: 90, perMinuteLimit: 14, ohshiDailyLimit: 20, ohshiMonthlyLimit: 300 },
  { code: "pro", label: "Pro", priceUsd: 15, monthlyRequestLimit: 1000, maxConnections: 5, maxApiKeys: 10, historyDays: 365, perMinuteLimit: 30, ohshiDailyLimit: 50, ohshiMonthlyLimit: 1000 },
];

/** One line per plan, the pitch under the price. */
export const PLAN_TAGLINE: Record<string, string> = {
  free: "Chat on OHS3 from day one. Nothing to pay, nothing to connect.",
  plus: "For daily chat and a couple of agents.",
  pro: "For teams of agents and long histories.",
};

export const historyLabel = (days: number) => (days >= 365 ? "1 year" : `${days} days`);

export function planPerks(plan: PlanRow): string[] {
  const own =
    plan.ohshiDailyLimit && plan.ohshiMonthlyLimit
      ? [`OHS3 and OHS3 Pro: ${plan.ohshiDailyLimit} replies a day, ${plan.ohshiMonthlyLimit.toLocaleString()} a month`]
      : [];
  return [
    ...own,
    `${plan.monthlyRequestLimit.toLocaleString()} successful requests a month on your own keys and accounts`,
    `${plan.maxConnections} connected account${plan.maxConnections === 1 ? "" : "s"}`,
    `${plan.maxApiKeys} API key${plan.maxApiKeys === 1 ? "" : "s"}`,
    `${historyLabel(plan.historyDays)} of history`,
    `${plan.perMinuteLimit} requests a minute`,
  ];
}

export type BillingProvider = "polar" | "paypal" | "";

export interface PlansPayload {
  plans: PlanRow[];
  /** Whether the backend has a payment provider configured. */
  billingEnabled: boolean;
  /** Which processor serves checkout. Polar is a merchant of record with a customer portal. */
  provider: BillingProvider;
  /** False when the route does not exist on this backend at all. */
  live: boolean;
}

/** The live matrix, or the mirror when the backend has no billing yet. */
export async function fetchPlans(): Promise<PlansPayload> {
  try {
    const data = await get<{ plans?: PlanRow[]; billingEnabled?: boolean; provider?: string }>("/api/billing/plans");
    const provider: BillingProvider = data.provider === "polar" || data.provider === "paypal" ? data.provider : "";
    return {
      plans: data.plans?.length ? data.plans : PLAN_FALLBACK,
      billingEnabled: Boolean(data.billingEnabled),
      provider,
      live: true,
    };
  } catch {
    return { plans: PLAN_FALLBACK, billingEnabled: false, provider: "", live: false };
  }
}
