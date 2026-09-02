/**
 * Overview — one screen that says how the workspace is doing and points to
 * the page with the detail: Models (quota), Usage (the ledger), Connected
 * accounts (keys, accounts, connector) and, on a billing backend, the plan.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleGauge,
  CreditCard,
  KeyRound,
  Layers,
  MessageSquare,
  Plug,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../App";
import { keyName } from "../components/GeminiKeysCard";
import { GeminiLogo, GoogleLogo } from "../components/logos";
import { FamilyRow } from "../components/QuotaGrid";
import { Badge, Button, Card, PageHeader, Progress, Skeleton, Stat } from "../components/ui";
import { formatNumber } from "../lib/api";
import { useConnections, useGeminiKeys, useQuotas, useUsage } from "../lib/workspace";

export default function Overview() {
  const { me } = useAuth();
  const { connections } = useConnections();
  const { gemini } = useGeminiKeys();
  const { usage } = useUsage(30);
  const { quotas } = useQuotas(connections);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const activeConnections = (connections ?? []).filter((c) => c.status === "active");
  const keys = gemini?.keys ?? [];
  const activeKeys = keys.filter((k) => k.status === "active");
  const route = gemini?.route ?? null;
  const sourcesKnown = connections !== null && gemini !== null;
  const activeSources = activeConnections.length + activeKeys.length;
  const totalSources = (connections?.length ?? 0) + keys.length;
  const needsAttention =
    (connections ?? []).filter((c) => c.status !== "active" || c.health?.status === "error").length +
    keys.filter((k) => k.status !== "active" || k.health?.status === "error").length;
  const families = Object.values(quotas).flatMap((q) => q.snapshot?.families ?? []);
  const requestCount = usage?.totals.requests ?? 0;
  const errorRate = usage && usage.totals.requests ? Math.round((usage.totals.errors / usage.totals.requests) * 100) : 0;
  const plan = usage?.entitlement;
  const firstName = (me?.user.displayName || me?.user.email.split("@")[0] || "there").split(/\s+/)[0];

  return (
    <div className="rise-in space-y-7">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="A quick read on your model sources, quota and gateway usage. Each card opens its page."
        actions={
          <>
            <Link to="/app/accounts">
              <Button tone="ghost">
                <Plug className="h-3.5 w-3.5" /> Connected accounts
              </Button>
            </Link>
            <Link to="/app">
              <Button>
                <MessageSquare className="h-3.5 w-3.5" /> New chat
              </Button>
            </Link>
          </>
        }
      />

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
          value={families.length || (activeConnections.length ? "…" : "0")}
          sub={
            families.length
              ? `${families.filter((f) => f.exhausted).length} out of quota`
              : activeConnections.length
                ? "Reading quota"
                : activeKeys.length
                  ? "API keys report no meter"
                  : "After you connect an account"
          }
        />
        <Stat icon={Activity} label="Gateway requests" value={usage ? formatNumber(requestCount) : "…"} sub={`Last ${usage?.windowDays ?? 30} days`} />
        <Stat
          icon={needsAttention ? TriangleAlert : CheckCircle2}
          label="Health"
          value={needsAttention ? `${needsAttention} issue${needsAttention > 1 ? "s" : ""}` : "Healthy"}
          sub={needsAttention ? "A source needs a check" : usage && requestCount ? `${errorRate}% gateway errors` : "Ready for your first run"}
          tone={needsAttention ? "warn" : undefined}
        />
      </div>

      {sourcesKnown && activeSources === 0 && <GetStarted />}

      {plan && plan.requestLimit > 0 && (
        <Card
          title={`${plan.label} plan`}
          description="Ohshi's own monthly allowance. The models still run on your key or account."
          aside={
            <ViewLink to="/app/billing" label="Plan and billing" />
          }
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="tnum text-[18px] font-semibold leading-none">
              {formatNumber(plan.requestsUsed)} <span className="text-[12.5px] font-normal text-ink-dim">of {formatNumber(plan.requestLimit)}</span>
            </span>
            <div className="min-w-[10rem] flex-1">
              <Progress
                percent={Math.min(100, Math.round((plan.requestsUsed / plan.requestLimit) * 100))}
                tone={plan.requestsRemaining === 0 ? "danger" : plan.requestsUsed / plan.requestLimit >= 0.8 ? "warn" : "accent"}
              />
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard icon={Layers} title="Models" to="/app/models" hint="Quota and what each key can call">
          {!sourcesKnown ? (
            <Rows n={3} />
          ) : families.length ? (
            <div className="space-y-1.5">
              {[...families]
                .sort((a, b) => (a.remainingPercent ?? 101) - (b.remainingPercent ?? 101))
                .slice(0, 4)
                .map((f) => (
                  <FamilyRow key={f.id} family={f} now={now} compact />
                ))}
            </div>
          ) : activeKeys.length ? (
            <p className="text-[12.5px] leading-relaxed text-ink-dim">
              {activeKeys.length} Gemini key{activeKeys.length === 1 ? "" : "s"}. A key has no quota meter; the Models page lists what it can call.
            </p>
          ) : activeConnections.length ? (
            <Rows n={3} />
          ) : (
            <p className="text-[12.5px] text-ink-dim">Connect a source to see models here.</p>
          )}
        </SummaryCard>

        <SummaryCard icon={Activity} title="Usage" to="/app/usage" hint={`Last ${usage?.windowDays ?? 30} days`}>
          {!usage ? (
            <Rows n={3} />
          ) : (
            <dl className="space-y-1.5 text-[12.5px]">
              <Row k="Requests" v={formatNumber(usage.totals.requests)} />
              <Row k="Tokens" v={formatNumber(usage.totals.totalTokens)} />
              <Row k="Errors" v={formatNumber(usage.totals.errors)} tone={usage.totals.errors ? "text-danger" : undefined} />
              <Row k="Top model" v={usage.byModel[0]?.model ?? "—"} mono />
            </dl>
          )}
        </SummaryCard>

        <SummaryCard icon={Plug} title="Connected accounts" to="/app/accounts" hint="Keys, accounts and the connector">
          {!sourcesKnown ? (
            <Rows n={3} />
          ) : totalSources === 0 ? (
            <p className="text-[12.5px] text-ink-dim">Nothing connected yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {keys.slice(0, 3).map((k) => (
                <SourceLine
                  key={k.id}
                  icon={<GeminiLogo className="h-3.5 w-3.5 text-ink-dim" />}
                  name={keyName(k)}
                  ok={k.status === "active" && k.health?.status !== "error"}
                  isDefault={route?.kind === "gemini_api" && route.id === k.id}
                />
              ))}
              {(connections ?? []).slice(0, 3).map((c) => (
                <SourceLine
                  key={c.id}
                  icon={<GoogleLogo className="h-3.5 w-3.5" />}
                  name={c.email}
                  ok={c.status === "active" && c.health?.status !== "error"}
                  isDefault={c.isDefault}
                />
              ))}
              {totalSources > 6 && <li className="text-[12px] text-ink-dim">+{totalSources - 6} more</li>}
            </ul>
          )}
        </SummaryCard>
      </div>
    </div>
  );
}

function SummaryCard(props: { icon: LucideIcon; title: string; to: string; hint: string; children: ReactNode }) {
  const Icon = props.icon;
  return (
    <Card
      title={
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-ink-dim" /> {props.title}
        </span>
      }
      description={props.hint}
      aside={<ViewLink to={props.to} label="View" />}
      className="flex flex-col"
    >
      {props.children}
    </Card>
  );
}

function ViewLink(props: { to: string; label: string }) {
  return (
    <Link to={props.to} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-ink-dim hover:text-ink">
      {props.label} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

function Row(props: { k: string; v: string; tone?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-dim">{props.k}</dt>
      <dd className={`tnum truncate font-medium ${props.mono ? "mono text-[11.5px]" : ""} ${props.tone ?? ""}`}>{props.v}</dd>
    </div>
  );
}

function Rows(props: { n: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: props.n }, (_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

function SourceLine(props: { icon: ReactNode; name: string; ok: boolean; isDefault: boolean }) {
  return (
    <li className="flex items-center gap-2 text-[12.5px]">
      {props.icon}
      <span className="min-w-0 flex-1 truncate">{props.name}</span>
      {props.isDefault && <Badge tone="accent">Default</Badge>}
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${props.ok ? "bg-ok" : "bg-danger"}`} />
    </li>
  );
}

/** Three steps, shown only while nothing is connected yet. */
function GetStarted() {
  const steps = [
    {
      n: "1",
      title: "Add a model source",
      text: "Paste a Gemini API key from Google AI Studio, or connect a Google account in Beta.",
      action: (
        <div className="flex flex-wrap gap-2">
          <Link to="/app/accounts?add=key">
            <Button size="sm">
              <KeyRound className="h-3.5 w-3.5" /> Add a key
            </Button>
          </Link>
          <Link to="/app/accounts?connect=1">
            <Button size="sm" tone="ghost">
              Connect Google
            </Button>
          </Link>
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
          <CreditCard className="hidden" />
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
