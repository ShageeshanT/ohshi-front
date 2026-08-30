/**
 * The public landing page at ohshi.space. Hero on the brand artwork, then
 * features, how it works, the model line-up, a developer snippet, FAQ, CTA
 * and the footer. Smooth-scrolled with Lenis, sections reveal on entry.
 */

import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Code2,
  KeyRound,
  Lock,
  MessagesSquare,
  Plug,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import heroDark from "../assets/hero-dark.webp";
import heroLight from "../assets/hero-light.webp";
import { ClaudeLogo, GeminiLogo, OpenAILogo } from "../components/logos";
import { MarketingFooter } from "../components/marketing/MarketingFooter";
import { MarketingNav } from "../components/marketing/MarketingNav";
import { Reveal } from "../components/marketing/Reveal";
import { SmoothScroll } from "../components/marketing/SmoothScroll";
import { useTheme } from "../lib/theme";
import { useLenis } from "lenis/react";

const ease = [0.16, 1, 0.3, 1] as const;
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
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

/** `/#features` from another page lands here after mount — scroll to it. */
function HashScroller() {
  const { hash } = useLocation();
  const lenis = useLenis();
  useEffect(() => {
    if (!hash) return;
    const el = document.querySelector<HTMLElement>(hash);
    if (!el) return;
    const t = window.setTimeout(() => {
      if (lenis) lenis.scrollTo(el, { offset: -96 });
      else el.scrollIntoView({ behavior: "smooth" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [hash, lenis]);
  return null;
}

// --- hero --------------------------------------------------------------------------

function Hero() {
  const { theme } = useTheme();
  const lenis = useLenis();
  const [loaded, setLoaded] = useState(false);

  const explore = () => {
    const el = document.querySelector<HTMLElement>("#features");
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -96 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden">
      {/* Brand artwork — anchored to the right so the spire stays clear of the copy. */}
      <img
        key={theme}
        src={theme === "dark" ? heroDark : heroLight}
        alt=""
        aria-hidden
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 -z-20 h-full w-full object-cover object-[72%_center] transition-opacity duration-700 md:object-right ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Fade the left side into the page colour so the headline stays crisp. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-surface via-surface/85 to-surface/10 md:via-surface/60 md:to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-surface to-transparent" />

      <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-6 pb-24 pt-36 sm:px-10 md:pt-40">
        <div className="max-w-2xl">
          <motion.div {...rise(0.05)}>
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              Bring your own Google account
            </span>
          </motion.div>
          <motion.h1
            {...rise(0.15)}
            className="hero-title mt-7 text-[2.9rem] sm:text-[4rem] md:text-[4.75rem] lg:text-[5.4rem]"
          >
            Your Google account.
            <br />
            <span className="hero-accent">Every frontier model.</span>
          </motion.h1>
          <motion.p {...rise(0.28)} className="mt-7 max-w-xl text-lg leading-relaxed text-ink-dim sm:text-xl">
            Ohshi turns the Google AI plan you already pay for into a chat workspace and an OpenAI-compatible API.
            Gemini, Claude and GPT-OSS — on your own quota, with live remaining usage.
          </motion.p>
          <motion.div {...rise(0.4)} className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/signup" className="btn-primary btn-lg">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <button type="button" onClick={explore} className="btn-ghost btn-lg">
              See how it works
            </button>
          </motion.div>
          <motion.ul
            {...rise(0.52)}
            className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-ink/80"
          >
            {[
              ["Runs on your quota", ShieldCheck],
              ["Tokens encrypted at rest", Lock],
              ["OpenAI-compatible API", Code2],
            ].map(([label, Icon]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <li key={label as string} className="flex items-center gap-2">
                  <I className="h-4 w-4 text-accent" />
                  {label as string}
                </li>
              );
            })}
          </motion.ul>
        </div>
      </div>

      <button
        type="button"
        onClick={explore}
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70 transition-colors hover:text-ink"
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{props.eyebrow}</p>
      <h2 className="mk-h2 mt-3">{props.title}</h2>
      {props.text && <p className="mt-4 text-base leading-relaxed text-ink-dim sm:text-lg">{props.text}</p>}
    </Reveal>
  );
}

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "A chat that feels like the big ones",
    text: "Streaming replies, rendered Markdown with copyable code, thinking traces, stop and regenerate — with the model picker showing how much quota each one has left.",
  },
  {
    icon: Code2,
    title: "An API your agents already speak",
    text: "Point any OpenAI SDK at /v1 with an ohs_ key. Chat completions, streaming and tool calling work unchanged; reasoning_effort picks the model variant.",
  },
  {
    icon: BarChart3,
    title: "Live remaining usage",
    text: "The exact per-model quota straight from Google, refreshed as you go, with reset countdowns — so you're never surprised by an exhausted model mid-task.",
  },
  {
    icon: Waypoints,
    title: "Failover built in",
    text: "Quota is enforced per Google endpoint. Ohshi tries the next one automatically, remembers what worked, and lets you connect several accounts with a default.",
  },
];

function Features() {
  return (
    <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <SectionHeader
        eyebrow="Features"
        title="Everything the plan gives you, in one place."
        text="You already pay Google for the models. Ohshi is the workspace and the API that make that plan usable everywhere."
      />
      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 70}>
            <div className="glass lift h-full p-6 sm:p-7">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-dim">{f.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: Plug,
    title: "Connect your Google account",
    text: "Sign in with Google, paste the code it shows you, done. Tokens are encrypted at rest and never leave the server.",
  },
  {
    icon: Sparkles,
    title: "Pick a model",
    text: "Gemini 3.6 Flash, Gemini 3.1 Pro, Claude Sonnet and Opus 4.6, GPT-OSS 120B — each with its live remaining quota beside it.",
  },
  {
    icon: KeyRound,
    title: "Chat, or hand your agents a key",
    text: "Use the chat workspace, or create an API key and drop the base URL into any OpenAI-compatible client.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="relative z-10 border-y border-edge/70 bg-panel-2/40 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeader eyebrow="How it works" title="Three steps. About two minutes." />
        <ol className="mt-14 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <li className="glass relative h-full p-6 sm:p-7">
                <span className="absolute right-6 top-6 text-4xl font-extrabold tracking-tight text-ink/[0.08]">
                  0{i + 1}
                </span>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-night text-white">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-dim">{s.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

const MODELS = [
  { name: "Gemini 3.6 Flash", vendor: "Google", note: "Fast default · low / medium / high", Logo: GeminiLogo },
  { name: "Gemini 3.1 Pro", vendor: "Google", note: "Deepest Gemini · low / high", Logo: GeminiLogo },
  { name: "Claude Sonnet 4.6", vendor: "Anthropic", note: "Thinking · 250k context", Logo: ClaudeLogo },
  { name: "Claude Opus 4.6", vendor: "Anthropic", note: "Thinking · 250k context", Logo: ClaudeLogo },
  { name: "GPT-OSS 120B", vendor: "OpenAI", note: "Open weights · medium reasoning", Logo: OpenAILogo },
  { name: "Gemini 3.5 Flash", vendor: "Google", note: "low / medium / high", Logo: GeminiLogo },
];

function Models() {
  return (
    <section id="models" className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-8 md:py-32">
      <SectionHeader
        eyebrow="Models"
        title="One login, three vendors."
        text="Whatever your Google plan lists is what you get — and anything new Google adds shows up by its own name."
      />
      <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODELS.map((m, i) => (
          <Reveal key={m.name} delay={i * 60}>
            <div className="glass lift flex items-center gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-edge bg-panel text-ink">
                <m.Logo className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold tracking-tight">{m.name}</p>
                <p className="truncate text-xs text-ink-dim">
                  {m.vendor} · {m.note}
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
  return (
    <section id="developers" className="relative z-10 border-y border-edge/70 bg-panel-2/40 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 md:grid-cols-2">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Developers</p>
          <h2 className="mk-h2 mt-3">Drop-in for anything that speaks OpenAI.</h2>
          <p className="mt-4 text-base leading-relaxed text-ink-dim sm:text-lg">
            Change two lines — the base URL and the key — and your existing agents, notebooks and frameworks run on your
            Google plan. Errors come back in the OpenAI shape, so your retry logic keeps working.
          </p>
          <ul className="mt-6 space-y-3 text-[15px] text-ink/85">
            {[
              "Chat completions, streaming and tool calling",
              "reasoning_effort maps to the model variant Google actually serves",
              "Per-key usage in the dashboard; revoke a key in one click",
              "429s only when every endpoint is truly out of quota",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120}>
          <div className="glass overflow-hidden p-2">
            <div className="flex items-center justify-between px-3 py-2 text-[11px] text-ink-dim">
              <span className="mono">agent.py</span>
              <span>Python · openai</span>
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

const FAQ = [
  {
    q: "Does Ohshi see my Google password?",
    a: "No. You sign in on Google's own page and Ohshi receives OAuth tokens scoped to the models. They are encrypted at rest and you can disconnect at any time.",
  },
  {
    q: "Whose quota do the models use?",
    a: "Yours. Every request runs on the Google account you connected, with that plan's limits. Ohshi shows the remaining amount per model so you always know where you stand.",
  },
  {
    q: "Which clients work with the API?",
    a: "Anything OpenAI-compatible — the official openai SDKs, LangChain, LlamaIndex, Vercel AI SDK, cURL. Set the base URL to /v1 and use an Ohshi key.",
  },
  {
    q: "Can I connect more than one Google account?",
    a: "Yes. Connect several, pick a default, and switch when one runs low. Each account's quota is tracked separately.",
  },
  {
    q: "What does it cost?",
    a: "Ohshi is free while in beta. The models are covered by the Google plan you already have — there is nothing to buy from us.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 py-24 sm:px-8 md:py-32">
      <SectionHeader eyebrow="FAQ" title="Questions, answered." />
      <div className="mt-12 space-y-3">
        {FAQ.map((item, i) => {
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
                  <span className="text-[15px] font-bold tracking-tight sm:text-base">{item.q}</span>
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
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24 sm:px-8 md:pb-32">
      <Reveal>
        <div className="glass hero-bloom relative overflow-hidden px-6 py-16 text-center sm:px-12 sm:py-20">
          <h2 className="mk-h2">Ready when you are.</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-dim sm:text-lg">
            Create an account, connect Google, and start chatting — or hand your agents a key. Two minutes, nothing to
            install.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup" className="btn-primary btn-lg">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="btn-ghost btn-lg">
              Sign In
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
