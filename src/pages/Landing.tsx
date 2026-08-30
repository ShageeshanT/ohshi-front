/**
 * The public landing page at ohshi.space. Hero laid out like the brand
 * mockup on the full-bleed artwork, then features, how it works, the model
 * line-up, a developer snippet, FAQ, CTA and the footer. Smooth-scrolled with
 * Lenis; sections reveal on entry. All words come from content/landing.ts.
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
  Waypoints,
} from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import heroDark from "../assets/hero-dark.webp";
import heroLight from "../assets/hero-light.webp";
import { ClaudeLogo, GeminiLogo, OpenAILogo } from "../components/logos";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { Reveal } from "../components/marketing/Reveal";
import { SmoothScroll } from "../components/marketing/SmoothScroll";
import { COPY } from "../content/landing";
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
        <Features />
        <HowItWorks />
        <Models />
        <Developers />
        <Faq />
        <CallToAction />
        <MarketingFooter />
      </div>
    </SmoothScroll>
  );
}

function scrollToHash(lenis: ReturnType<typeof useLenis>, hash: string) {
  const el = document.querySelector<HTMLElement>(hash);
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
      {/* The artwork keeps its own aspect ratio and is anchored right, so the
          whole spire and its ring stay in frame at every window size instead of
          being cropped by a full-bleed cover. Its inner edge feathers into the
          page colour, which is the same tone as the art's own field. */}
      <div className="hero-art">
        <img
          key={theme}
          src={theme === "dark" ? heroDark : heroLight}
          alt=""
          aria-hidden
          draggable={false}
          onLoad={() => setLoaded(true)}
          className={`transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-surface to-transparent" />

      <div className="hero-shell mx-auto flex min-h-[100svh] max-w-[1460px] flex-col justify-center px-6 sm:px-10 lg:px-[5.5%]">
        <div className="max-w-[52rem]">
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
          <motion.p {...rise(0.28)} className="hero-lede hero-gap max-w-[30rem] text-ink-dim">
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
            className="hero-gap-lg flex flex-wrap items-center gap-y-1 text-[13px] font-medium text-ink/80"
          >
            {h.trust.map((label, i) => (
              <li
                key={label}
                className={`flex items-center gap-2 py-1 pr-5 ${i === 0 ? "" : "sm:border-l sm:border-ink/15 sm:pl-5"}`}
              >
                <ShieldCheck className="h-4 w-4 text-accent" />
                {label}
              </li>
            ))}
          </motion.ul>
        </div>
      </div>

      <button
        type="button"
        onClick={() => scrollToHash(lenis, "#features")}
        className="hero-cue absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.14em] text-ink/70 transition-colors hover:text-ink"
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

const FEATURE_ICONS = [MessagesSquare, Code2, BarChart3, Waypoints];

function Features() {
  const f = COPY.features;
  return (
    <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <SectionHeader eyebrow={f.eyebrow} title={f.title} text={f.intro} />
      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {f.cards.map((card, i) => {
          const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
          return (
            <Reveal key={card.title} delay={i * 70}>
              <div className="glass lift h-full p-6 sm:p-7">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-dim">{card.text}</p>
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
        <SectionHeader eyebrow={h.eyebrow} title={h.title} />
        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {h.steps.map((s, i) => {
            const Icon = STEP_ICONS[i % STEP_ICONS.length];
            return (
              <Reveal key={s.title} delay={i * 90}>
                <li className="glass relative h-full p-6 sm:p-7">
                  <span className="absolute right-6 top-6 text-4xl font-semibold tracking-tight text-ink/[0.08]">
                    0{i + 1}
                  </span>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-night text-white">
                    <Icon className="h-5 w-5" />
                  </span>
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

function Models() {
  const m = COPY.models;
  return (
    <section id="models" className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <SectionHeader eyebrow={m.eyebrow} title={m.title} text={m.intro} />
      <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    <section id="developers" className="relative z-10 border-y border-edge/70 bg-panel-2/40 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 md:grid-cols-2">
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
