import { Link } from "react-router-dom";
import { COPY } from "../../content/landing";
import { Wordmark } from "../brand";
import { ThemeToggle } from "./ThemeToggle";

const YEAR = new Date().getFullYear();

export function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-edge bg-panel">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Wordmark className="h-7" />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-dim">{COPY.footer.tagline}</p>
          <div className="mt-4">
            <ThemeToggle />
          </div>
        </div>
        <FooterColumn
          title="Product"
          links={[
            { label: "Why Ohshi", to: "/#features" },
            { label: "How it works", to: "/#how" },
            { label: "Providers", to: "/#models" },
            { label: "Live quota", to: "/#quota" },
            { label: "Pricing", to: "/#pricing" },
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
            { label: "Terms and conditions", to: "/terms" },
            { label: "Privacy policy", to: "/privacy" },
          ]}
        />
      </div>
      <div className="border-t border-edge">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 text-[12px] text-ink-dim sm:px-8">
          <span className="flex items-center gap-1.5">
            © {YEAR} Ohshi
            <span aria-hidden className="h-1 w-1 rounded-full bg-current opacity-50" />
            ohshi.space
          </span>
          <span className="max-w-2xl">{COPY.footer.disclaimer}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn(props: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-ink">{props.title}</p>
      <ul className="mt-3 space-y-2">
        {props.links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="text-[13px] text-ink-dim transition-colors hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
