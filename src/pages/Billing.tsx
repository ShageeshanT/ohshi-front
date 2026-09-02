/**
 * Plan and billing — Ohshi's own plan, separate from any connected provider
 * account. The page only ever *asks*: upgrades go to Dodo's hosted checkout
 * and the plan flips when Dodo's signed webhook reaches the backend, so coming
 * back from a payment can be a few seconds ahead of the plan (the polling
 * below, keyed off the ?checkout=done return URL). On a backend without
 * billing the plans still show, with the paid buttons waiting.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpRight, CreditCard, ShieldCheck } from "lucide-react";
import { useAuth, type Me } from "../App";
import { ArrowLoopDoodle, StarsDoodle } from "../components/Doodles";
import { PlanCard } from "../components/PlanCard";
import { Badge, Button, Card, Notice, PageHeader, Progress, SectionTitle } from "../components/ui";
import { formatNumber, friendly, get, post } from "../lib/api";
import { fetchPlans, type PlansPayload } from "../lib/plans";
import { useUsage } from "../lib/workspace";

const FINE_PRINT = [
  "Only successful requests count. A failed call hands its slot back.",
  "Downgrading locks extras instead of deleting them. Upgrade again and they wake up.",
  "Chat and usage history outside your plan's window is pruned.",
  "Cancel any time. A paid plan stays active until the period already paid for ends.",
];

export default function Billing() {
  const { me, setMe } = useAuth();
  const [params] = useSearchParams();
  const { usage } = useUsage(30);
  const [plans, setPlans] = useState<PlansPayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPlans().then((p) => {
      if (!cancelled) setPlans(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const justPaid = params.get("checkout") === "done";
  const plan = me?.user.plan ?? "free";
  const paid = plan !== "free";
  const billingEnabled = plans?.billingEnabled ?? me?.config.billingEnabled ?? false;
  const status = me?.user.subscriptionStatus ?? null;
  const renews = me?.user.planRenewsMs
    ? new Date(me.user.planRenewsMs).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null;
  const entitlement = usage?.entitlement;
  const rows = plans?.plans ?? [];
  const current = rows.find((p) => p.code === plan) ?? rows[0];

  // Back from Dodo: the webhook usually lands a few seconds after the
  // redirect, so poll /me until the plan flips instead of showing a stale
  // "Free" next to a success note.
  useEffect(() => {
    if (!justPaid || paid) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      get<Me>("/api/auth/me")
        .then(setMe)
        .catch(() => {});
      if (tries >= 8) window.clearInterval(timer);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [justPaid, paid, setMe]);

  const checkout = (target: string) => {
    setBusy(target);
    setError(null);
    post<{ url: string }>("/api/billing/checkout", { plan: target })
      .then(({ url }) => {
        window.location.href = url;
      })
      .catch((err) => {
        setError(friendly(err));
        setBusy(null);
      });
  };

  const openPortal = () => {
    setBusy("portal");
    setError(null);
    post<{ url: string }>("/api/billing/portal")
      .then(({ url }) => {
        window.location.href = url;
      })
      .catch((err) => {
        setError(friendly(err));
        setBusy(null);
      });
  };

  const rank = (code: string) => rows.findIndex((p) => p.code === code);

  return (
    <div className="rise-in space-y-7">
      <PageHeader
        title="Plan and billing"
        description="Ohshi's own allowance on top of the access you connect. The models keep running on your key or your plan; Ohshi never resells model access."
      />

      {justPaid && !paid && <Notice tone="accent">Payment received. Activating your plan, this takes a few seconds.</Notice>}
      {error && (
        <Notice tone="danger" onClose={() => setError(null)}>
          {error}
        </Notice>
      )}

      <Card className="relative overflow-hidden">
        <StarsDoodle className="pointer-events-none absolute -right-2 -top-1 h-20 w-28 text-ink-faint" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink-dim">Current plan</p>
            <p className="mt-1 flex items-center gap-2 text-[22px] font-semibold leading-none tracking-tight">
              {current?.label ?? (paid ? plan[0].toUpperCase() + plan.slice(1) : "Free")}
              {paid && status === "cancelled" && <Badge tone="warn">Cancelled</Badge>}
              {!paid && !billingEnabled && <Badge tone="ok" dot>Free during beta</Badge>}
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-dim">
              {paid && renews ? (status === "cancelled" ? `Stays active until ${renews}.` : `Renews ${renews}.`) : null}
              {!paid && (billingEnabled ? "No card on file. Upgrade whenever you outgrow it." : "Paid plans open soon. Everything is free until then.")}
            </p>
            {entitlement && entitlement.requestLimit > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="tnum text-[13px] font-medium">
                  {formatNumber(entitlement.requestsUsed)} <span className="font-normal text-ink-dim">of {formatNumber(entitlement.requestLimit)} requests this month</span>
                </span>
                <div className="min-w-[10rem] flex-1">
                  <Progress
                    percent={Math.min(100, Math.round((entitlement.requestsUsed / entitlement.requestLimit) * 100))}
                    tone={entitlement.requestsRemaining === 0 ? "danger" : entitlement.requestsUsed / entitlement.requestLimit >= 0.8 ? "warn" : "accent"}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {billingEnabled && paid && (
              <Button tone="ghost" busy={busy === "portal"} onClick={openPortal}>
                <CreditCard className="h-3.5 w-3.5" /> Manage billing <ArrowUpRight className="h-3.5 w-3.5 text-ink-dim" />
              </Button>
            )}
            {billingEnabled && !paid && rows[1] && (
              <Button busy={busy === rows[1].code} onClick={() => checkout(rows[1].code)}>
                Upgrade to {rows[1].label}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <SectionTitle
          title="Plans"
          description="Pick the allowance that fits. Every plan runs on the same models, from your own key or account."
          aside={<ArrowLoopDoodle className="hidden h-8 w-16 text-ink-faint sm:block" />}
        />
        <div className="grid gap-3 pt-2 md:grid-cols-3">
          {rows.map((p) => {
            const isCurrent = p.code === plan;
            const upgrade = rank(p.code) > rank(plan);
            let action: React.ReactNode;
            if (isCurrent) {
              action = (
                <Button tone="ghost" disabled className="w-full">
                  Your current plan
                </Button>
              );
            } else if (!billingEnabled) {
              action = (
                <Button tone="ghost" disabled className="w-full">
                  {p.priceUsd > 0 ? "Coming soon" : "Included"}
                </Button>
              );
            } else if (p.priceUsd === 0) {
              action = (
                <Button tone="ghost" busy={busy === "portal"} onClick={openPortal} className="w-full">
                  Move to Free
                </Button>
              );
            } else {
              action = (
                <Button tone={upgrade ? "primary" : "ghost"} busy={busy === p.code} onClick={() => checkout(p.code)} className="w-full">
                  {upgrade ? `Upgrade to ${p.label}` : `Switch to ${p.label}`}
                </Button>
              );
            }
            return <PlanCard key={p.code} plan={p} popular={p.code === "plus"} current={isCurrent} action={action} />;
          })}
        </div>
      </section>

      <Card title="The fine print" description="Short, because there is not much of it.">
        <ul className="grid gap-x-8 gap-y-2 text-[12.5px] text-ink-dim sm:grid-cols-2">
          {FINE_PRINT.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-4 inline-flex items-start gap-2 text-[12px] text-ink-dim">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-ok" />
          Checkout, taxes, invoices and cancellation are handled by Dodo Payments, the merchant of record. Your card details never touch Ohshi.
        </p>
      </Card>
    </div>
  );
}
