import type { ReactNode } from "react";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingNav } from "./MarketingNav";
import { SmoothScroll } from "./SmoothScroll";

/** Frame for the Terms / Privacy pages: nav, a readable column, footer. */
export function LegalLayout(props: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <SmoothScroll>
      <div className="relative min-h-screen bg-surface">
        <MarketingNav minimal />
        <main className="relative z-10 mx-auto max-w-3xl px-5 pb-24 pt-36 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{props.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{props.title}</h1>
          <p className="mt-3 text-sm text-ink-dim">Last updated {props.updated}</p>
          <div className="glass mt-8 p-6 text-[15px] leading-relaxed text-ink/85 sm:p-7">{props.intro}</div>
          <div className="legal-prose mt-4">{props.children}</div>
        </main>
        <MarketingFooter />
      </div>
    </SmoothScroll>
  );
}
