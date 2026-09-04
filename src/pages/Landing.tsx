/**
 * The public landing page at ohshi.space. The hero is the painting, full
 * frame, with the copy straight on it over a soft bloom; then the pitch: why one
 * source beats a
 * subscription plus API credits (a before and after wiring diagram), how it
 * works with a mock of each step, the providers and their plans (a hub
 * diagram) with the model line-up, a live quota board, a developer snippet,
 * FAQ, CTA and the footer. Smooth-scrolled with Lenis; sections reveal on
 * entry. All words come from content/landing.ts; the diagrams and mocks from
 * components/marketing/Diagrams.tsx.
 */

import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
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
import { BrandMark } from "../components/brand";
import { SparkleDoodle, SquiggleDoodle } from "../components/Doodles";
import { ClaudeLogo, DeepSeekLogo, GeminiLogo, OpenAILogo, XaiLogo } from "../components/logos";
import { PlanCard } from "../components/PlanCard";
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
import { PLAN_FALLBACK, fetchPlans, type BillingProvider, type PlanRow } from "../lib/plans";
import { useTheme } from "../lib/theme";

const ease = [0.16, 1, 0.3, 1] as const;
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease, delay },
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
  if (lenis) lenis.scrollTo(el, { offset: -90 });
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
      {/* The painting fills the frame. Two plates: a 16:9 one for landscape
          windows and a portrait one below md, so a phone downloads the cut
          that fits it. Each theme has its own painting. */}
      <div className="hero-art">
        <picture key={theme}>
          <source media="(max-width: 767px)" srcSet={theme === "dark" ? heroMobileDark : heroMobileLight} />
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

      <div className="hero-shell mx-auto flex min-h-[100svh] max-w-[1460px] flex-col justify-center px-5 sm:px-10 lg:px-[5.5%]">
        <div className="hero-copy max-w-[36rem]">
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
          <motion.div {...rise(0.4)} className="hero-gap-lg flex flex-wrap items-center gap-2.5">
            <Link to="/signup" className="btn-primary btn-lg">
              {h.primaryCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <button type="button" onClick={() => scrollToHash(lenis, "#developers")} className="btn-ghost btn-lg">
              {h.secondaryCta}
            </button>
          </motion.div>
          <motion.ul {...rise(0.52)} className="hero-trust hero-gap-lg flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
            {h.trust.map((label) => (
              <li key={label} className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                {label}
              </li>
            ))}
          </motion.ul>
        </div>
      </div>

      <button
        type="button"
        onClick={() => scrollToHash(lenis, "#features")}
        className="hero-copy hero-cue absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-[11.5px] font-medium uppercase tracking-[0.14em] text-ink/85 transition-colors hover:text-ink"
      >
        Scroll to explore
        <ChevronDown className="scroll-cue h-4.5 w-4.5" />
      </button>
    </section>
  );
}

// --- sections ---------------------------------------------------------------------

function SectionHeader(props: { eyebrow: string; title: string; text?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="eyebrow justify-center">{props.eyebrow}</p>
      <h2 className="mk-h2 mt-3">{props.title}</h2>
      {props.text && <p className="mt-3.5 text-[15px] leading-relaxed text-ink-dim">{props.text}</p>}
    </Reveal>
  );
}

const FEATURE_ICONS = [MessagesSquare, Code2, BarChart3, KeyRound];

/** The pitch: the before and after wiring, then the four things you get. */
function Why() {
  const f = COPY.why;
  return (
    <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
      <SectionHeader eyebrow={f.eyebrow} title={f.title} text={f.intro} />
      <Reveal className="mt-12">
        <PayTwiceDiagram />
      </Reveal>
      <Reveal className="mt-3">
        <div className="tiles sm:grid-cols-2 lg:grid-cols-4">
          {f.cards.map((card, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
            return (
              <div key={card.title} className="p-5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-panel-2 text-ink">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-4 text-[14.5px] font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-dim">{card.text}</p>
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

const STEP_ICONS = [Plug, Sparkles, KeyRound];

function HowItWorks() {
  const h = COPY.how;
  return (
    <section id="how" className="relative z-10 border-y border-edge bg-panel py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeader eyebrow={h.eyebrow} title={h.title} text={h.intro} />
        <Reveal className="mt-12">
          <ol className="tiles md:grid-cols-3">
            {h.steps.map((s, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <li key={s.title} className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-night text-night-ink">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-ink-faint">Step 0{i + 1}</span>
                  </div>
                  <div className="mt-4">
                    <StepMock step={i} />
                  </div>
                  <h3 className="mt-4 text-[14.5px] font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-dim">{s.text}</p>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

const MODELS = [
  { name: "Gemini 3.6 Flash", vendor: "Google", note: "Fast default, three effort levels", Logo: GeminiLogo },
  { name: "Gemini 3.1 Pro", vendor: "Google", note: "Deepest Gemini, two effort levels", Logo: GeminiLogo },
  { name: "Claude Sonnet 4.6", vendor: "Anthropic", note: "Thinking, 250k context", Logo: ClaudeLogo },
  { name: "Claude Opus 4.6", vendor: "Anthropic", note: "Thinking, 250k context", Logo: ClaudeLogo },
  { name: "GPT-5.5", vendor: "OpenAI", note: "On a ChatGPT plan, every effort level", Logo: OpenAILogo },
  { name: "GPT-OSS 120B", vendor: "OpenAI", note: "Open weights, medium reasoning", Logo: OpenAILogo },
  { name: "DeepSeek V4 Flash", vendor: "DeepSeek", note: "Thinking, 1M context, on your API key", Logo: DeepSeekLogo },
  { name: "DeepSeek V4 Pro", vendor: "DeepSeek", note: "Deepest DeepSeek, thinking, 1M context", Logo: DeepSeekLogo },
  { name: "DeepSeek V4 Flash Vision", vendor: "DeepSeek", note: "Image input, experimental", Logo: DeepSeekLogo },
];

/** The hub diagram, a card per provider, then what a plan lists today. */
function Providers() {
  const p = COPY.providers;
  const m = COPY.models;
  return (
    <section id="models" className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
      <SectionHeader eyebrow={p.eyebrow} title={p.title} text={p.intro} />
      <Reveal className="mt-12">
        <div className="card p-5 sm:p-7">
          <ProviderHub />
        </div>
      </Reveal>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((pr, i) => (
          <Reveal key={pr.id} delay={i * 60}>
            <ProviderCard provider={pr} />
          </Reveal>
        ))}
      </div>

      <Reveal className="mx-auto mt-20 max-w-2xl text-center">
        <p className="eyebrow justify-center">{m.eyebrow}</p>
        <h3 className="mk-h3 mt-3">{m.title}</h3>
        <p className="mt-3.5 text-[15px] leading-relaxed text-ink-dim">{m.intro}</p>
      </Reveal>
      <Reveal className="mt-8">
        <div className="tiles sm:grid-cols-2 lg:grid-cols-3">
          {MODELS.map((model) => (
            <div key={model.name} className="flex items-center gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-edge bg-panel text-ink">
                <model.Logo className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium tracking-tight">{model.name}</p>
                <p className="flex items-center gap-1.5 text-[12px] text-ink-dim">
                  <span className="shrink-0">{model.vendor}</span>
                  <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                  <span className="truncate">{model.note}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Quota() {
  const q = COPY.quota;
  return (
    <section id="quota" className="relative z-10 border-y border-edge bg-panel py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-8 md:grid-cols-2 md:gap-14">
        <Reveal className="min-w-0 md:order-2">
          <p className="eyebrow">{q.eyebrow}</p>
          <h2 className="mk-h2 mt-3">{q.title}</h2>
          <p className="mt-3.5 text-[15px] leading-relaxed text-ink-dim">{q.paragraph}</p>
          <ul className="mt-5 space-y-2.5 text-[14px] text-ink/85">
            {q.bullets.map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={100} className="min-w-0 md:order-1">
          <QuotaBoard />
        </Reveal>
      </div>
    </section>
  );
}

function Pricing() {
  const p = COPY.pricing;
  const [plans, setPlans] = useState<PlanRow[]>(PLAN_FALLBACK);
  // Until the backend answers, promise nothing: the cautious copy is the one
  // that is safe to be wrong about.
  const [buyable, setBuyable] = useState(false);
  const [provider, setProvider] = useState<BillingProvider>("");

  useEffect(() => {
    let cancelled = false;
    void fetchPlans().then((data) => {
      if (cancelled) return;
      setPlans(data.plans);
      setBuyable(data.billingEnabled);
      setProvider(data.provider);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
      <SectionHeader eyebrow={p.eyebrow} title={p.title} text={buyable ? p.introLive : p.intro} />
      <div className="mt-12 grid gap-3 md:grid-cols-3">
        {plans.map((plan, i) => {
          const popular = plan.code === "plus";
          return (
            <Reveal key={plan.code} delay={i * 70} className="min-w-0">
              <PlanCard
                plan={plan}
                popular={popular}
                action={
                  <Link to="/signup" className={`${popular ? "btn-primary" : "btn-ghost"} w-full`}>
                    {plan.priceUsd > 0 ? `${p.paidCta} ${plan.label}` : p.freeCta}
                  </Link>
                }
              />
            </Reveal>
          );
        })}
      </div>
      <Reveal className="mx-auto mt-8 max-w-3xl">
        <ul className="grid gap-x-8 gap-y-1.5 text-[12.5px] text-ink-dim sm:grid-cols-2">
          {[...p.fine, ...(buyable && provider ? [p.fineByProvider[provider]] : [])].map((line) => (
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
    <section id="developers" className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8 md:py-28">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <Reveal>
          <p className="eyebrow">{d.eyebrow}</p>
          <h2 className="mk-h2 mt-3">{d.title}</h2>
          <p className="mt-3.5 text-[15px] leading-relaxed text-ink-dim">{d.paragraph}</p>
          <ul className="mt-5 space-y-2.5 text-[14px] text-ink/85">
            {d.bullets.map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
          <ul className="mt-6 flex flex-wrap gap-1.5">
            {d.integrations.map((name) => (
              <li key={name} className="rounded-md border border-edge bg-panel px-2.5 py-1 text-[12px] font-medium text-ink/85">
                {name}
              </li>
            ))}
          </ul>
        </Reveal>
        {/* min-w-0: without it the code block's longest line sets the grid
            track's min-content width and pushes the page sideways. */}
        <Reveal delay={100} className="min-w-0">
          <div className="card overflow-hidden p-1.5">
            <div className="flex items-center justify-between px-3 py-2 text-[11.5px] text-ink-dim">
              <span className="mono">agent.py</span>
              <span className="flex items-center gap-1.5">
                Python
                <span aria-hidden className="h-1 w-1 rounded-full bg-current opacity-50" />
                openai
              </span>
            </div>
            <pre className="mono overflow-x-auto rounded-lg bg-code p-4 text-[12.5px] leading-relaxed text-[#e6e8eb]">
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
    <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 py-20 sm:px-8 md:py-28">
      <SectionHeader eyebrow={f.eyebrow} title={f.title} />
      <Reveal className="mt-10">
        <div className="card divide-y divide-edge overflow-hidden">
          {f.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-ink/[0.02]"
                  aria-expanded={isOpen}
                >
                  <span className="text-[14px] font-medium tracking-tight">{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-ink-dim transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-ink-dim">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

/** The closing card: the pitch on the left, and on the right the four
 *  providers wired into the Ohshi mark, drawn live. The last two words of the
 *  title get a pen underline. */
function CallToAction() {
  const c = COPY.cta;
  const words = c.title.split(" ");
  const head = words.slice(0, -2).join(" ");
  const tail = words.slice(-2).join(" ");
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8 md:pb-28">
      <Reveal>
        <div className="card relative overflow-hidden">
          <div className="cta-dots" aria-hidden />
          <div className="relative grid items-center gap-10 px-6 py-12 sm:px-10 sm:py-14 md:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="eyebrow">Get started</p>
              <h2 className="mk-h2 mt-3">
                {head}{" "}
                <span className="relative inline-block whitespace-nowrap">
                  {tail}
                  <SquiggleDoodle className="absolute -bottom-1 left-0 h-2.5 w-full text-accent" />
                </span>
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-dim">{c.text}</p>
              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Link to="/signup" className="btn-primary">
                  {c.primary} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/app/docs" className="btn-ghost">
                  {c.secondary}
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-ink-dim">
                {["No card needed", "Your own key or plan", "Keys encrypted at rest"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-accent" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <Constellation />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

const CONSTELLATION = [
  { id: "google", label: "Gemini", sub: "Live", live: true, Logo: GeminiLogo, x: 14, y: 22 },
  { id: "anthropic", label: "Claude", sub: "Next", live: false, Logo: ClaudeLogo, x: 86, y: 18 },
  { id: "openai", label: "GPT", sub: "Live", live: true, Logo: OpenAILogo, x: 12, y: 80 },
  { id: "xai", label: "Grok", sub: "Next", live: false, Logo: XaiLogo, x: 88, y: 78 },
];

/** Four providers around the mark, joined by drifting wires. */
function Constellation() {
  return (
    <div className="relative mx-auto h-64 w-full max-w-[26rem] md:h-72">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
        {CONSTELLATION.map((n) => {
          const d = `M ${n.x} ${n.y} C ${(n.x + 50) / 2} ${n.y}, ${(n.x + 50) / 2} 50, 50 50`;
          return (
            <g key={n.id} fill="none" strokeWidth={1.5}>
              <path d={d} className="wire" vectorEffect="non-scaling-stroke" />
              <path d={d} className="wire-flow" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </svg>
      <span className="dg-hub absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full">
        <BrandMarkInline />
      </span>
      {CONSTELLATION.map((n) => (
        <span
          key={n.id}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border border-edge bg-panel py-1.5 pl-1.5 pr-2.5 shadow-[0_1px_2px_rgb(0_0_0/0.05)]"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
        >
          <span className="grid h-7 w-7 place-items-center rounded-md border border-edge bg-panel text-ink">
            <n.Logo className="h-3.5 w-3.5" />
          </span>
          <span className="leading-tight">
            <span className="block text-[12.5px] font-medium">{n.label}</span>
            <span className={`block text-[10.5px] ${n.live ? "text-ok" : "text-ink-faint"}`}>{n.sub}</span>
          </span>
        </span>
      ))}
      <SparkleDoodle className="absolute left-[38%] top-[8%] h-9 w-9 text-accent" />
      <SparkleDoodle className="absolute right-[30%] bottom-[6%] h-7 w-7 text-ink-faint" />
    </div>
  );
}

function BrandMarkInline() {
  return <BrandMark className="h-7" />;
}
