/**
 * The wiring diagrams and the small UI mocks on the landing page.
 *
 * A diagram is a CSS grid of HTML nodes with an SVG in each gap column. The
 * SVG draws in a 100 by 100 box stretched to its cell (preserveAspectRatio
 * none), so a path from the left edge at 25% to the right edge at 50% lands
 * on the node centres whatever the cell's real size, and non-scaling-stroke
 * keeps the line one width. Node columns are equal-row grids with the padding
 * inside each row, so the row centres sit at exact fractions of the column
 * height. A dashed accent stroke drifts along each wire (.wire-flow in
 * index.css) and holds still under prefers-reduced-motion.
 *
 * Below md the grids collapse to stacks joined by arrow icons: a five column
 * row does not fit a phone.
 */

import { motion } from "framer-motion";
import {
  ArrowDown,
  Bot,
  Check,
  Coins,
  CreditCard,
  MessagesSquare,
  Terminal,
  Timer,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { COPY, PROVIDERS, type Provider, type ProviderId } from "../../content/landing";
import { BrandMark } from "../brand";
import { ClaudeLogo, GeminiLogo, GoogleLogo, OpenAILogo, XaiLogo } from "../logos";

const ease = [0.16, 1, 0.3, 1] as const;

type Logo = ComponentType<{ className?: string }>;

export const PROVIDER_LOGOS: Record<ProviderId, Logo> = {
  google: GoogleLogo,
  openai: OpenAILogo,
  anthropic: ClaudeLogo,
  xai: XaiLogo,
};

// --- primitives -------------------------------------------------------------------

/** Row centres, in percent, of an n-row column. */
const centres = (n: number) => Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * 100);

type Link = [from: number, to: number];

/** Wires across a gap column: each link runs from a height on the left edge
 *  to a height on the right edge, both in percent of the cell. */
function Wires(props: { links: Link[] }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      className="block h-full w-full overflow-visible"
    >
      {props.links.map(([a, b]) => {
        const d = `M 0 ${a} C 50 ${a}, 50 ${b}, 100 ${b}`;
        return (
          <g key={d} fill="none" strokeWidth={1.5}>
            <path d={d} className="wire" vectorEffect="non-scaling-stroke" />
            <path d={d} className="wire-flow" vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}

/** An equal-row column. Each child is centred in its row, so the row centres
 *  sit at (i + 0.5) / n of the column height, which is where the wires aim. */
function Column(props: { children: ReactNode[] }) {
  return (
    <div
      className="grid min-w-0"
      style={{ gridTemplateRows: `repeat(${props.children.length}, minmax(0, 1fr))` }}
    >
      {props.children.map((child, i) => (
        <div key={i} className="flex min-w-0 items-center py-1.5">
          {child}
        </div>
      ))}
    </div>
  );
}

type Tone = "plain" | "accent" | "night" | "danger" | "ok";

const ICON_TONE: Record<Tone, string> = {
  plain: "border border-edge bg-panel-2 text-ink",
  accent: "bg-accent-soft text-accent",
  night: "bg-night text-night-ink",
  danger: "bg-danger-soft text-danger",
  ok: "bg-ok-soft text-ok",
};

function Node(props: {
  icon: ReactNode;
  label: string;
  sub?: string;
  tone?: Tone;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`dg-node ${props.className ?? ""}`}>
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${ICON_TONE[props.tone ?? "plain"]}`}
      >
        {props.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold leading-tight tracking-tight text-ink">
          {props.label}
        </span>
        {props.sub && <span className="block truncate text-[11.5px] text-ink-dim">{props.sub}</span>}
      </span>
      {props.badge}
    </div>
  );
}

/** The Ohshi mark in a lit ring. The caption hangs below the ring without
 *  taking space, so the ring itself is what the wires are centred on; in a
 *  vertical stack the caption sits in flow instead. */
function Hub(props: { label: string; sub: string; captionInFlow?: boolean }) {
  const caption = (
    <span className="flex flex-col items-center whitespace-nowrap">
      <span className="text-[13px] font-semibold tracking-tight text-ink">{props.label}</span>
      <span className="mono text-[11px] text-ink-dim">{props.sub}</span>
    </span>
  );
  return (
    <div className="relative flex flex-col items-center gap-2">
      <span className="dg-hub grid place-items-center rounded-full">
        <BrandMark className="h-8" />
      </span>
      {props.captionInFlow ? caption : <span className="absolute top-full mt-2">{caption}</span>}
    </div>
  );
}

function Caption(props: { title: string; accent?: boolean }) {
  return (
    <p
      className={`flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] ${
        props.accent ? "text-accent" : "text-ink-dim"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${props.accent ? "bg-accent" : "bg-current opacity-60"}`} />
      {props.title}
    </p>
  );
}

function Tally(props: { items: string[]; note: string; accent?: boolean }) {
  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-edge pt-4">
      <ul className="flex items-center gap-1.5">
        {props.items.map((t) => (
          <li
            key={t}
            className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
              props.accent ? "bg-accent-soft text-accent" : "bg-ink/[0.06] text-ink-dim"
            }`}
          >
            {t}
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] text-ink-dim">{props.note}</p>
    </div>
  );
}

function Down() {
  return <ArrowDown className="h-4 w-4 text-ink-dim" aria-hidden />;
}

// --- why: pay once ------------------------------------------------------------------

/** Two cards: a subscription and API credits each feeding their own thing,
 *  against one subscription feeding chat and the API through Ohshi. */
export function PayTwiceDiagram() {
  const { before, after } = COPY.why;
  const fromIcon = (i: number) =>
    i === 0 ? <CreditCard className="h-4.5 w-4.5" /> : <Coins className="h-4.5 w-4.5" />;
  const toIcon = (i: number) =>
    i === 0 ? <MessagesSquare className="h-4.5 w-4.5" /> : <Bot className="h-4.5 w-4.5" />;
  const [r25, r75] = centres(2);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card flex flex-col p-4 sm:p-5">
        <Caption title={before.title} />

        <div className="mb-5 mt-5 hidden flex-1 grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] md:grid">
          <Column>
            {before.rows.map((r, i) => (
              <Node
                key={r.from}
                icon={fromIcon(i)}
                label={r.from}
                sub={r.fromSub}
                tone={i === 0 ? "plain" : "danger"}
              />
            ))}
          </Column>
          <Wires
            links={[
              [r25, r25],
              [r75, r75],
            ]}
          />
          <Column>
            {before.rows.map((r, i) => (
              <Node key={r.to} icon={toIcon(i)} label={r.to} sub={r.toSub} />
            ))}
          </Column>
        </div>

        <div className="mb-5 mt-5 space-y-3 md:hidden">
          {before.rows.map((r, i) => (
            <div
              key={r.from}
              className={`flex flex-col items-center gap-2 ${i > 0 ? "border-t border-edge pt-3" : ""}`}
            >
              <Node icon={fromIcon(i)} label={r.from} sub={r.fromSub} tone={i === 0 ? "plain" : "danger"} />
              <Down />
              <Node icon={toIcon(i)} label={r.to} sub={r.toSub} />
            </div>
          ))}
        </div>

        <Tally items={before.tally} note={before.note} />
      </div>

      <div className="card flex flex-col p-4 ring-1 ring-accent/30 sm:p-5">
        <Caption title={after.title} accent />

        <div className="mb-5 mt-5 hidden flex-1 grid-cols-[minmax(0,1fr)_2.5rem_auto_2.5rem_minmax(0,1fr)] pb-9 md:grid">
          <Column>
            {[
              <Node
                key="source"
                icon={<CreditCard className="h-4.5 w-4.5" />}
                label={after.source}
                sub={after.sourceSub}
                tone="accent"
              />,
            ]}
          </Column>
          <Wires links={[[50, 50]]} />
          <div className="flex items-center px-1">
            <Hub label={after.hub} sub={after.hubSub} />
          </div>
          <Wires
            links={[
              [50, r25],
              [50, r75],
            ]}
          />
          <Column>
            {after.outputs.map((o, i) => (
              <Node key={o.label} icon={toIcon(i)} label={o.label} sub={o.sub} tone="accent" />
            ))}
          </Column>
        </div>

        <div className="mb-5 mt-5 flex flex-col items-center gap-2 md:hidden">
          <Node
            icon={<CreditCard className="h-4.5 w-4.5" />}
            label={after.source}
            sub={after.sourceSub}
            tone="accent"
          />
          <Down />
          <Hub label={after.hub} sub={after.hubSub} captionInFlow />
          <Down />
          <div className="grid w-full gap-2">
            {after.outputs.map((o, i) => (
              <Node key={o.label} icon={toIcon(i)} label={o.label} sub={o.sub} tone="accent" />
            ))}
          </div>
        </div>

        <Tally items={after.tally} note={after.note} accent />
      </div>
    </div>
  );
}

// --- providers: the hub -------------------------------------------------------------

function Status(props: { live: boolean }) {
  const p = COPY.providers;
  return (
    <span
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${
        props.live ? "bg-ok-soft text-ok" : "bg-ink/[0.06] text-ink-dim"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${props.live ? "status-pulse bg-current" : "bg-current opacity-50"}`}
      />
      {props.live ? p.liveLabel : p.soonLabel}
    </span>
  );
}

function ProviderNode({ provider }: { provider: Provider }) {
  const Logo = PROVIDER_LOGOS[provider.id];
  return (
    <Node
      icon={<Logo className="h-4.5 w-4.5" />}
      label={provider.vendor}
      sub={provider.plans.join(", ")}
      badge={<Status live={provider.live} />}
    />
  );
}

function OutputNode({ index }: { index: number }) {
  const o = COPY.providers.outputs[index];
  return (
    <Node
      icon={index === 0 ? <MessagesSquare className="h-4.5 w-4.5" /> : <Terminal className="h-4.5 w-4.5" />}
      label={o.label}
      sub={o.sub}
      tone="night"
    />
  );
}

/** Every provider on the left, the mark in the middle, chat and the API on
 *  the right: one key for all of them. */
export function ProviderHub() {
  const p = COPY.providers;
  const left = centres(PROVIDERS.length);
  const [r25, r75] = centres(2);

  return (
    <>
      <div className="hidden grid-cols-[minmax(0,1.15fr)_4rem_auto_4rem_minmax(0,1fr)] pb-8 md:grid">
        <Column>
          {PROVIDERS.map((pr) => (
            <ProviderNode key={pr.id} provider={pr} />
          ))}
        </Column>
        <Wires links={left.map((y): Link => [y, 50])} />
        <div className="flex items-center px-2">
          <Hub label={p.hub} sub={p.hubSub} />
        </div>
        <Wires
          links={[
            [50, r25],
            [50, r75],
          ]}
        />
        <Column>
          {p.outputs.map((_, i) => (
            <OutputNode key={i} index={i} />
          ))}
        </Column>
      </div>

      <div className="flex flex-col items-center gap-3 md:hidden">
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {PROVIDERS.map((pr) => (
            <ProviderNode key={pr.id} provider={pr} />
          ))}
        </div>
        <Down />
        <Hub label={p.hub} sub={p.hubSub} captionInFlow />
        <Down />
        <div className="grid w-full gap-2">
          {p.outputs.map((_, i) => (
            <OutputNode key={i} index={i} />
          ))}
        </div>
      </div>
    </>
  );
}

export function ProviderCard({ provider }: { provider: Provider }) {
  const p = COPY.providers;
  const Logo = PROVIDER_LOGOS[provider.id];
  return (
    <div className="card card-hover flex h-full flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-edge bg-panel text-ink">
          <Logo className="h-5 w-5" />
        </span>
        <Status live={provider.live} />
      </div>
      <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{provider.vendor}</h3>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint">{p.plansLabel}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {provider.plans.map((plan) => (
          <li
            key={plan}
            className="rounded-full border border-edge bg-panel px-2.5 py-1 text-[12px] font-medium text-ink/85"
          >
            {plan}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint">{p.modelsLabel}</p>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-dim">{provider.models}</p>
    </div>
  );
}

// --- live quota ---------------------------------------------------------------------

const QUOTA_DEMO: { name: string; Logo: Logo; pct: number }[] = [
  { name: "Gemini 3.6 Flash", Logo: GeminiLogo, pct: 82 },
  { name: "Gemini 3.1 Pro", Logo: GeminiLogo, pct: 64 },
  { name: "Claude Opus 4.6", Logo: ClaudeLogo, pct: 41 },
  { name: "Claude Sonnet 4.6", Logo: ClaudeLogo, pct: 23 },
  { name: "GPT-OSS 120B", Logo: OpenAILogo, pct: 97 },
];

const meterTone = (pct: number) => (pct > 50 ? "bg-ok" : pct > 25 ? "bg-warn" : "bg-danger");

/** The dashboard's quota card, with the meters filling as it scrolls in. */
export function QuotaBoard() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-edge px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-edge bg-panel">
            <GoogleLogo className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold tracking-tight">Google AI Pro</p>
            <p className="truncate text-[11.5px] text-ink-dim">Default account</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium text-ink-dim">
          <Timer className="h-3.5 w-3.5" />
          Resets in 3h 40m
        </span>
      </div>
      <ul className="divide-y divide-edge px-5">
        {QUOTA_DEMO.map((m, i) => (
          <li key={m.name} className="grid grid-cols-[auto_minmax(0,1fr)_3rem] items-center gap-3 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-edge bg-panel text-ink">
              <m.Logo className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{m.name}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
                <motion.div
                  className={`h-full rounded-full ${meterTone(m.pct)}`}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${m.pct}%` }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 1.1, ease, delay: 0.15 + i * 0.08 }}
                />
              </div>
            </div>
            <span className="mono text-right text-[12.5px] font-medium tabular-nums">{m.pct}%</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-edge bg-surface px-5 py-3 text-[11.5px] text-ink-dim">
        <span className="status-pulse h-1.5 w-1.5 rounded-full bg-ok text-ok" />
        Read live from the provider
      </div>
    </div>
  );
}

// --- how it works: the mocks --------------------------------------------------------

function Mock(props: { children: ReactNode }) {
  return (
    <div className="flex flex-col justify-center rounded-lg border border-edge bg-surface p-3 md:min-h-[10.5rem]">
      {props.children}
    </div>
  );
}

function ConnectMock() {
  return (
    <Mock>
      <div className="grid grid-cols-4 gap-2">
        {PROVIDERS.map((p, i) => {
          const Logo = PROVIDER_LOGOS[p.id];
          return (
            <span
              key={p.id}
              className={`grid h-10 place-items-center rounded-xl border bg-panel ${
                i === 0 ? "border-accent/60 text-ink ring-2 ring-accent/20" : "border-edge text-ink-dim"
              }`}
            >
              <Logo className="h-4.5 w-4.5" />
            </span>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-edge bg-panel px-3 py-2">
        <span className="mono truncate text-[11.5px] text-ink-dim">4/0AX4XfWhQ2n…</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-semibold text-ok">
          <Check className="h-3.5 w-3.5" />
          Connected
        </span>
      </div>
    </Mock>
  );
}

function PickMock() {
  const rows = QUOTA_DEMO.slice(0, 3);
  return (
    <Mock>
      <ul className="space-y-1.5">
        {rows.map((m, i) => (
          <li
            key={m.name}
            className={`grid grid-cols-[auto_minmax(0,1fr)_2.5rem] items-center gap-2.5 rounded-xl px-2.5 py-2 ${
              i === 0 ? "bg-panel ring-1 ring-accent/30" : ""
            }`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-edge bg-panel text-ink">
              <m.Logo className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium">{m.name}</span>
              <span className="mt-1 block h-1 overflow-hidden rounded-full bg-ink/[0.08]">
                <span className={`block h-full rounded-full ${meterTone(m.pct)}`} style={{ width: `${m.pct}%` }} />
              </span>
            </span>
            <span className="mono text-right text-[11.5px] tabular-nums text-ink-dim">{m.pct}%</span>
          </li>
        ))}
      </ul>
    </Mock>
  );
}

function CallMock() {
  return (
    <Mock>
      <div className="flex items-center gap-2 rounded-xl bg-bubble-me px-3 py-2 text-[12.5px]">
        <MessagesSquare className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="truncate">Summarise this thread for me</span>
      </div>
      <pre className="mono mt-2 overflow-hidden rounded-xl bg-code px-3 py-2.5 text-[11.5px] leading-relaxed text-[#e6e8eb]">
        <span className="text-[#9fb3ff]">base_url</span>=&quot;ohshi.space/v1&quot;{"\n"}
        <span className="text-[#9fb3ff]">api_key</span>=&quot;ohs_
        <span className="text-ink-dim">••••••••</span>&quot;
      </pre>
    </Mock>
  );
}

const MOCKS = [ConnectMock, PickMock, CallMock];

export function StepMock(props: { step: number }) {
  const M = MOCKS[props.step % MOCKS.length];
  return <M />;
}
