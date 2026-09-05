/** The plan's meter for Ohshi's own models (OHS3, OHS3 Pro): replies used
 *  today and this month, each as a small bar. Sits under the plan's request
 *  allowance on the Overview, Usage and Billing pages. Renders nothing when
 *  the backend has no host for the models. */

import { formatNumber } from "../lib/api";
import type { Entitlement } from "../lib/workspace";
import { Progress } from "./ui";

export function OhshiMeter(props: { plan: Entitlement }) {
  const { plan } = props;
  if (plan.ohshiDailyLimit === undefined || plan.ohshiMonthlyLimit === undefined) return null;
  const rows: { label: string; used: number; limit: number }[] = [
    { label: "today", used: plan.ohshiDailyUsed ?? 0, limit: plan.ohshiDailyLimit },
    { label: "this month", used: plan.ohshiMonthlyUsed ?? 0, limit: plan.ohshiMonthlyLimit },
  ];
  return (
    <div className="mt-4 border-t border-edge pt-3">
      <p className="text-[12.5px]">
        <span className="font-medium">Ohshi&apos;s own models</span>{" "}
        <span className="text-ink-dim">OHS3 and OHS3 Pro, nothing to connect. Metered per day and per month.</span>
      </p>
      <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => {
          const pct = row.limit > 0 ? Math.min(100, Math.round((row.used / row.limit) * 100)) : 0;
          return (
            <div key={row.label} className="flex items-center gap-3">
              <span className="tnum min-w-[9.5rem] shrink-0 text-[12.5px]">
                <span className="font-medium">{formatNumber(row.used)}</span>{" "}
                <span className="text-ink-dim">
                  of {formatNumber(row.limit)} {row.label}
                </span>
              </span>
              <div className="min-w-[6rem] flex-1">
                <Progress percent={pct} tone={pct >= 100 ? "danger" : pct >= 80 ? "warn" : "accent"} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
