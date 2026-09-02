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
        <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20 pt-28 sm:px-8">
          <p className="eyebrow">{props.eyebrow}</p>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight sm:text-[36px]">{props.title}</h1>
          <p className="mt-2 text-[13px] text-ink-dim">Last updated {props.updated}</p>
          <div className="card mt-7 p-5 text-[14px] leading-relaxed text-ink/85">{props.intro}</div>
          <div className="legal-prose mt-3">{props.children}</div>
        </main>
        <MarketingFooter />
      </div>
    </SmoothScroll>
  );
}
