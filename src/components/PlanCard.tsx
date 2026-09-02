/** One plan, as a card: a doodle in the corner, the price, the pitch, the
 *  perks and whatever action the page passes in. Shared by the landing
 *  pricing section and the billing page. */

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { PLAN_TAGLINE, planPerks, type PlanRow } from "../lib/plans";
import { PlaneDoodle, RocketDoodle, SparkleDoodle } from "./Doodles";

const DOODLE: Record<string, (p: { className?: string }) => ReactNode> = {
  free: PlaneDoodle,
  plus: SparkleDoodle,
  pro: RocketDoodle,
};

export function PlanCard(props: {
  plan: PlanRow;
  popular?: boolean;
  current?: boolean;
  action: ReactNode;
  className?: string;
}) {
  const { plan } = props;
  const Doodle = DOODLE[plan.code] ?? SparkleDoodle;
  return (
    <div
      className={`card relative flex h-full flex-col p-5 ${
        props.popular ? "ring-1 ring-ink" : ""
      } ${props.className ?? ""}`}
    >
      <Doodle className={`absolute right-4 top-4 h-14 w-14 ${props.popular ? "text-accent" : "text-ink-faint"}`} />
      {props.popular && (
        <span className="absolute left-5 top-0 -translate-y-1/2 rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-semibold text-panel">
          Most popular
        </span>
      )}
      {props.current && !props.popular && (
        <span className="absolute left-5 top-0 -translate-y-1/2 rounded-full border border-edge bg-panel px-2 py-0.5 text-[10.5px] font-semibold text-ink-dim">
          Your plan
        </span>
      )}
      <p className="text-[12.5px] font-medium text-ink-dim">{plan.label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[30px] font-semibold leading-none tracking-tight">${plan.priceUsd}</span>
        <span className="text-[12.5px] text-ink-dim">{plan.priceUsd > 0 ? "per month" : "forever"}</span>
      </p>
      <p className="mt-2 text-[12.5px] leading-snug text-ink-dim">{PLAN_TAGLINE[plan.code] ?? ""}</p>
      <ul className="mt-4 space-y-2 text-[13px]">
        {planPerks(plan).map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <span className="mt-[3px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <span className="text-ink/90">{perk}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex-1" />
      {props.action}
    </div>
  );
}
