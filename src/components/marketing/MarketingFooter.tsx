import { Link } from "react-router-dom";
import { COPY } from "../../content/landing";
import { Wordmark } from "../brand";
import { ThemeToggle } from "./ThemeToggle";

const YEAR = new Date().getFullYear();

export function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-edge/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark className="h-9" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-dim">{COPY.footer.tagline}</p>
          <div className="mt-5">
            <ThemeToggle />
          </div>
        </div>
        <FooterColumn
          title="Product"
          links={[
            { label: "Features", to: "/#features" },
            { label: "How It Works", to: "/#how" },
            { label: "Models", to: "/#models" },
            { label: "Developers", to: "/#developers" },
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            { label: "Sign In", to: "/login" },
            { label: "Create Account", to: "/signup" },
            { label: "Open the App", to: "/app" },
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
          <span className="flex items-center gap-1.5">
            © {YEAR} Ohshi
            <span aria-hidden className="h-1 w-1 rounded-full bg-current opacity-50" />
            ohshi.space
          </span>
          <span>{COPY.footer.disclaimer}</span>
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
