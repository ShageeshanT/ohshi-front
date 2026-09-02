/**
 * The public landing page at ohshi.space. Hero laid out like the brand
 * mockup on the full-bleed artwork, then the pitch: why one subscription
 * beats a subscription plus API credits (a before and after wiring diagram),
 * how it works with a mock of each step, the providers and their plans (a hub
 * diagram) with the model line-up, a live quota board, a developer snippet,
 * FAQ, CTA and the footer. Smooth-scrolled with Lenis; sections reveal on
 * entry. All words come from content/landing.ts; the diagrams and mocks from
 * components/marketing/Diagrams.tsx.
 */

import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Code2,
  KeyRound,
  MessagesSquare,
  Plug,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import heroDark from "../assets/hero-dark.webp";
import heroLight from "../assets/hero-light.webp";
import heroMobileDark from "../assets/hero-mobile-dark.webp";
import heroMobileLight from "../assets/hero-mobile-light.webp";
import { ClaudeLogo, GeminiLogo, OpenAILogo } from "../components/logos";
import {
  PayTwiceDiagram,
  ProviderCard,
  ProviderHub,
  QuotaBoard,
  StepMock,
} from "../components/marketing/Diagrams";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { Reveal } from "../components/marketing/Reveal";
import { SmoothScroll } from "../components/marketing/SmoothScroll";
import { COPY, PROVIDERS } from "../content/landing";
import { get } from "../lib/api";
import { useTheme } from "../lib/theme";

const ease = [0.16, 1, 0.3, 1] as const;
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease, delay },
});

export default function Landing() {
  return (
    <SmoothScroll>
      <div className="relative min-h-screen bg-surface">
        <MarketingNav />
        <HashScroller />
        <Hero />
        <Why />
        <HowItWorks />
        <Providers />
        <Quota />
        <Pricing />
        <Developers />
        <Faq />
        <CallToAction />
        <MarketingFooter />
      </div>
    </SmoothScroll>
  );
}

function scrollToHash(lenis: ReturnType<typeof useLenis>, hash: string) {
  // Only a plain element id — anything else in the fragment is not a selector
  // this page should evaluate.
  if (!/^#[A-Za-z][\w-]*$/.test(hash)) return;
  const el = document.getElementById(hash.slice(1));
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -110 });
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** `/#features` from another page lands here after mount — scroll to it. */
function HashScroller() {
  const { hash } = useLocation();
  const lenis = useLenis();
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => scrollToHash(lenis, hash), 250);
    return () => window.clearTimeout(t);
  }, [hash, lenis]);
  return null;
}

// --- hero --------------------------------------------------------------------------

function Hero() {
  const { theme } = useTheme();
  const lenis = useLenis();
  const [loaded, setLoaded] = useState(false);
  const h = COPY.hero;

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden">
      {/* The painting fills the frame. It is cut two ways: a 16:9 plate for
          landscape windows and a portrait plate below md, so a phone downloads
          the one that fits it rather than a wide crop of the other. The scrim
          that keeps the copy legible lives on .hero-art::after. */}
      <div className="hero-art">
        <picture key={theme}>
          <source
            media="(max-width: 767px)"
            srcSet={theme === "dark" ? heroMobileDark : heroMobileLight}
          />
          <img
            src={theme === "dark" ? heroDark : heroLight}
            alt=""
            aria-hidden
            draggable={false}
            fetchPriority="high"
            onLoad={() => setLoaded(true)}
            className={`transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        </picture>
      </div>
      <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-surface to-transparent" />

      <div className="hero-shell mx-auto flex min-h-[100svh] max-w-[1460px] flex-col justify-center px-6 sm:px-10 lg:px-[5.5%]">
        <div className="hero-copy max-w-[52rem]">
          <motion.div {...rise(0.05)}>
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              {h.badge}
            </span>
          </motion.div>
          <motion.h1 {...rise(0.15)} className="hero-title hero-gap">
            {h.line1}
            <br />
            {h.line2}
          </motion.h1>
          <motion.p {...rise(0.28)} className="hero-lede hero-gap max-w-[30rem]">
            {h.paragraph}
          </motion.p>
          <motion.div {...rise(0.4)} className="hero-gap-lg flex flex-wrap items-center gap-3">
            <Link to="/signup" className="btn-primary btn-lg">
              {h.primaryCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => scrollToHash(lenis, "#developers")} className="btn-ghost btn-lg">
              {h.secondaryCta}
            </button>
          </motion.div>
          <motion.ul
            {...rise(0.52)}
            className="hero-trust hero-gap-lg flex flex-wrap items-center gap-y-1 text-[13px]"
          >
            {h.trust.map((label, i) => (
              <li
                key={label}
                className={`flex items-center gap-2 py-1 pr-5 ${i === 0 ? "" : "sm:border-l sm:border-ink/30 sm:pl-5"}`}
              >
                <ShieldCheck className="hero-trust-icon h-4 w-4 shrink-0 text-accent" />
                {label}
              </li>
            ))}
          </motion.ul>
        </div>
      </div>

      <button
        type="button"
        onClick={() => scrollToHash(lenis, "#features")}
        className="hero-copy hero-cue absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.14em] text-ink/85 transition-colors hover:text-ink"
      >
        Scroll to explore
        <ChevronDown className="scroll-cue h-5 w-5" />
      </button>
    </section>
  );
}

// --- sections ---------------------------------------------------------------------

function SectionHeader(props: { eyebrow: string; title: string; text?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">{props.eyebrow}</p>
      <h2 className="mk-h2 mt-3">{props.title}</h2>
      {props.text && <p className="mt-4 text-[17px] leading-relaxed text-ink-dim">{props.text}</p>}
    </Reveal>
  );
}

const FEATURE_ICONS = [MessagesSquare, Code2, BarChart3, KeyRound];

/** The pitch: the before and after wiring, then the four things you get. */
function Why() {
  const f = COPY.why;
  return (
    <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <SectionHeader eyebrow={f.eyebrow} title={f.title} text={f.intro} />
      <Reveal className="mt-14">
        <PayTwiceDiagram />
      </Reveal>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {f.cards.map((card, i) => {
          const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
          return (
            <Reveal key={card.title} delay={i * 70}>
              <div className="glass lift h-full p-6">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-dim">{card.text}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

const STEP_ICONS = [Plug, Sparkles, KeyRound];

function HowItWorks() {
  const h = COPY.how;
  return (
    <section id="how" className="relative z-10 border-y border-edge/70 bg-panel-2/40 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeader eyebrow={h.eyebrow} title={h.title} text={h.intro} />
        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {h.steps.map((s, i) => {
            const Icon = STEP_ICONS[i % STEP_ICONS.length];
            return (
              <Reveal key={s.title} delay={i * 90}>
                <li className="glass flex h-full flex-col p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-night text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
                      Step 0{i + 1}
                    </span>
                  </div>
                  <div className="mt-5">
                    <StepMock step={i} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-dim">{s.text}</p>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const MODELS = [
  { name: "Gemini 3.6 Flash", vendor: "Google", note: "Fast default, three effort levels", Logo: GeminiLogo },
  { name: "Gemini 3.1 Pro", vendor: "Google", note: "Deepest Gemini, two effort levels", Logo: GeminiLogo },
  { name: "Claude Sonnet 4.6", vendor: "Anthropic", note: "Thinking, 250k context", Logo: ClaudeLogo },
  { name: "Claude Opus 4.6", vendor: "Anthropic", note: "Thinking, 250k context", Logo: ClaudeLogo },
  { name: "GPT-OSS 120B", vendor: "OpenAI", note: "Open weights, medium reasoning", Logo: OpenAILogo },
  { name: "Gemini 3.5 Flash", vendor: "Google", note: "Three effort levels", Logo: GeminiLogo },
];

/** The hub diagram, a card per provider, then what a plan lists today. */
function Providers() {
  const p = COPY.providers;
  const m = COPY.models;
  return (
    <section id="models" className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <SectionHeader eyebrow={p.eyebrow} title={p.title} text={p.intro} />
      <Reveal className="mt-14">
        <div className="glass p-5 sm:p-8">
          <ProviderHub />
        </div>
      </Reveal>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PROVIDERS.map((pr, i) => (
          <Reveal key={pr.id} delay={i * 70}>
            <ProviderCard provider={pr} />
          </Reveal>
        ))}
      </div>

      <Reveal className="mx-auto mt-24 max-w-2xl text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">{m.eyebrow}</p>
        <h3 className="mk-h3 mt-3">{m.title}</h3>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-dim">{m.intro}</p>
      </Reveal>
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* min-w-0 on each card: the model name and note never wrap, so without
            it the single column on a phone widens to fit them and the page
            slides sideways. */}
        {MODELS.map((model, i) => (
          <Reveal key={model.name} delay={i * 60} className="min-w-0">
            <div className="glass lift flex items-center gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-edge bg-panel text-ink">
                <model.Logo className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight">{model.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-ink-dim">
                  <span className="shrink-0">{model.vendor}</span>
                  <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                  <span className="truncate">{model.note}</span>
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Quota() {
  const q = COPY.quota;
  return (
    <section id="quota" className="relative z-10 border-y border-edge/70 bg-panel-2/40 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 md:grid-cols-2">
        <Reveal className="min-w-0 md:order-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">{q.eyebrow}</p>
          <h2 className="mk-h2 mt-3">{q.title}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-dim">{q.paragraph}</p>
          <ul className="mt-6 space-y-3 text-[15px] text-ink/85">
            {q.bullets.map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120} className="min-w-0 md:order-1">
          <QuotaBoard />
        </Reveal>
      </div>
    </section>
  );
}


interface PlanRow {
  code: string;
  label: string;
  priceUsd: number;
  monthlyRequestLimit: number;
  maxConnections: number;
  maxApiKeys: number;
  historyDays: number;
  perMinuteLimit: number;
}

// Mirrors entitlements.PLANS so the section paints instantly; the fetch in
// Pricing() overwrites it with whatever the backend actually enforces, so a
// price or limit change needs no edit here to show up.
const PLAN_FALLBACK: PlanRow[] = [
  { code: "free", label: "Free", priceUsd: 0, monthlyRequestLimit: 50, maxConnections: 1, maxApiKeys: 1, historyDays: 7, perMinuteLimit: 3 },
  { code: "plus", label: "Plus", priceUsd: 6, monthlyRequestLimit: 200, maxConnections: 2, maxApiKeys: 3, historyDays: 90, perMinuteLimit: 14 },
  { code: "pro", label: "Pro", priceUsd: 17, monthlyRequestLimit: 1000, maxConnections: 5, maxApiKeys: 10, historyDays: 365, perMinuteLimit: 30 },
];

const historyLabel = (days: number) => (days >= 365 ? "1 year" : `${days} days`);

function planPerks(plan: PlanRow): string[] {
  return [
    `${plan.monthlyRequestLimit.toLocaleString()} successful requests a month`,
    `${plan.maxConnections} connected account${plan.maxConnections === 1 ? "" : "s"}`,
    `${plan.maxApiKeys} API key${plan.maxApiKeys === 1 ? "" : "s"}`,
    `${historyLabel(plan.historyDays)} of history`,
    `${plan.perMinuteLimit} requests a minute`,
  ];
}

function Pricing() {
  const p = COPY.pricing;
  const [plans, setPlans] = useState<PlanRow[]>(PLAN_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    get<{ plans?: PlanRow[] }>("/api/billing/plans")
      .then((data) => {
        if (!cancelled && data.plans?.length) setPlans(data.plans);
      })
      .catch(() => {
        /* the mirror above keeps the section honest even offline */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <SectionHeader eyebrow={p.eyebrow} title={p.title} text={p.intro} />
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {plans.map((plan, i) => {
          const popular = plan.code === "plus";
          return (
            <Reveal key={plan.code} delay={i * 80} className="min-w-0">
              <div
                className={`glass lift relative flex h-full flex-col p-6 sm:p-7 ${
                  popular ? "ring-1 ring-accent/40" : ""
                }`}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-accent-ink">
                    {p.popular}
                  </span>
                )}
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
                  {plan.label}
                </p>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight">${plan.priceUsd}</span>
                  <span className="text-sm text-ink-dim">{plan.priceUsd > 0 ? "/ month" : "forever"}</span>
                </p>
                <ul className="mt-6 space-y-2.5 text-[14px] text-ink/85">
                  {planPerks(plan).map((perk) => (
                    <li key={perk} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex-1" />
                <Link to="/signup" className={`${popular ? "btn-primary" : "btn-ghost"} w-full`}>
                  {plan.priceUsd > 0 ? `${p.paidCta} ${plan.label}` : p.freeCta}
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>
      <Reveal className="mx-auto mt-8 max-w-3xl">
        <ul className="grid gap-x-8 gap-y-1.5 text-[12.5px] text-ink-dim sm:grid-cols-2">
          {p.fine.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
              {line}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

const SNIPPET = `from openai import OpenAI

client = OpenAI(
    base_url="https://www.ohshi.space/v1",
    api_key="ohs_…",
)

resp = client.chat.completions.create(
    model="gemini-3.6-flash",
    reasoning_effort="high",
    messages=[{"role": "user", "content": "hello"}],
    stream=True,
)`;

function Developers() {
  const d = COPY.developers;
  return (
    <section id="developers" className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">{d.eyebrow}</p>
          <h2 className="mk-h2 mt-3">{d.title}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-ink-dim">{d.paragraph}</p>
          <ul className="mt-6 space-y-3 text-[15px] text-ink/85">
            {d.bullets.map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
          <ul className="mt-7 flex flex-wrap gap-2">
            {d.integrations.map((name) => (
              <li
                key={name}
                className="rounded-full border border-edge bg-panel px-3 py-1.5 text-[12.5px] font-medium text-ink/85"
              >
                {name}
              </li>
            ))}
          </ul>
        </Reveal>
        {/* min-w-0: without it the code block's longest line sets the grid
            track's min-content width and pushes the page sideways. */}
        <Reveal delay={120} className="min-w-0">
          <div className="glass overflow-hidden p-2">
            <div className="flex items-center justify-between px-3 py-2 text-[11px] text-ink-dim">
              <span className="mono">agent.py</span>
              <span className="flex items-center gap-1.5">
                Python
                <span aria-hidden className="h-1 w-1 rounded-full bg-current opacity-50" />
                openai
              </span>
            </div>
            <pre className="mono overflow-x-auto rounded-2xl bg-code p-5 text-[13px] leading-relaxed text-[#e6e8eb]">
              <code>{SNIPPET}</code>
            </pre>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Faq() {
  const f = COPY.faq;
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 py-24 sm:px-8 md:py-32">
      <SectionHeader eyebrow={f.eyebrow} title={f.title} />
      <div className="mt-12 space-y-3">
        {f.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={item.q} delay={i * 50}>
              <div className="glass overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15px] font-semibold tracking-tight sm:text-base">{item.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-ink-dim transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 text-[15px] leading-relaxed text-ink-dim">{item.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function CallToAction() {
  const c = COPY.cta;
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24 sm:px-8 md:pb-32">
      <Reveal>
        <div className="glass hero-bloom relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-20">
          <h2 className="mk-h2">{c.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-ink-dim">{c.text}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup" className="btn-primary btn-lg">
              {c.primary} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/app/docs" className="btn-ghost btn-lg">
              {c.secondary}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
