import { Link } from "react-router-dom";
import { Wordmark } from "../brand";
import { ThemeToggle } from "./ThemeToggle";

const YEAR = new Date().getFullYear();

export function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-edge/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark className="h-9" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-dim">
            Your Google account, every frontier model. Chat with Gemini, Claude and GPT-OSS, and give your agents an
            OpenAI-compatible API — on the plan you already have.
          </p>
          <div className="mt-5">
            <ThemeToggle />
          </div>
        </div>
        <FooterColumn
          title="Product"
          links={[
            { label: "Features", to: "/#features" },
            { label: "How it works", to: "/#how" },
            { label: "Models", to: "/#models" },
            { label: "Developers", to: "/#developers" },
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            { label: "Sign in", to: "/login" },
            { label: "Create account", to: "/signup" },
            { label: "Open the app", to: "/app" },
          ]}
        />
        <FooterColumn
          title="Legal"
          links={[
            { label: "Terms and Conditions", to: "/terms" },
            { label: "Privacy Policy", to: "/privacy" },
          ]}
        />
      </div>
      <div className="border-t border-edge/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-ink-dim sm:px-8">
          <span>© {YEAR} Ohshi · ohshi.space</span>
          <span>Not affiliated with Google. Model quota belongs to the Google account you connect.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn(props: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">{props.title}</p>
      <ul className="mt-4 space-y-2.5">
        {props.links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-sm text-ink/80 transition-colors hover:text-accent">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
