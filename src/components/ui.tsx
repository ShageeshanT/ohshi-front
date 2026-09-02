/** Shared UI kit — token-only, so it renders correctly on both themes.
 *  Flat white panels, hairline borders, 8px radii, one ink primary. */

import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { ArrowUpRight, Loader2, User, X } from "lucide-react";

export type Tone = "accent" | "ok" | "warn" | "danger" | "violet" | "dim";

const toneText: Record<Tone, string> = {
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  violet: "text-violet",
  dim: "text-ink-dim",
};

const toneSoft: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  violet: "bg-violet-soft text-violet",
  dim: "bg-ink/[0.06] text-ink-dim",
};

const toneBar: Record<Tone, string> = {
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  violet: "bg-violet",
  dim: "bg-ink-dim",
};

export const toneTextClass = (tone: Tone) => toneText[tone];

/** Keep an overlay mounted briefly after it closes so its exit animation can finish. */
export function usePresence(open: boolean, exitMs = 160): boolean {
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    if (!rendered) return;
    const timer = window.setTimeout(() => setRendered(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [exitMs, open, rendered]);

  return rendered;
}

/** Freeze the page behind an open overlay, and return the undo. */
export function lockPageScroll(): () => void {
  const target = document.getElementById("main-content") ?? document.body;
  const previous = target.style.overflowY;
  target.style.overflowY = "hidden";
  return () => {
    target.style.overflowY = previous;
  };
}

// ── layout ──────────────────────────────────────────────────────────────────

/** The title row at the top of a page's content. */
export function PageHeader(props: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[18px] font-semibold tracking-tight">{props.title}</h1>
        {props.description && <p className="mt-0.5 max-w-2xl text-[13px] text-ink-dim">{props.description}</p>}
      </div>
      {props.actions && <div className="flex flex-wrap items-center gap-2">{props.actions}</div>}
    </header>
  );
}

/** A section heading above a card or a group of cards. */
export function SectionTitle(props: {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  aside?: ReactNode;
}) {
  const Icon = props.icon;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-ink-dim" />}
          <h2 className="text-[14px] font-semibold tracking-tight">{props.title}</h2>
          {props.badge}
        </div>
        {props.description && <p className="mt-0.5 text-[12.5px] text-ink-dim">{props.description}</p>}
      </div>
      {props.aside}
    </div>
  );
}

// ── primitives ───────────────────────────────────────────────────────────────

export function Card(props: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  /** No body padding: the content draws its own edges (a table, a list). */
  flush?: boolean;
  compact?: boolean;
}) {
  const hasHeader = props.title || props.aside;
  return (
    <section className={`card ${props.className ?? ""}`}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 border-b border-edge px-4 py-3">
          <div className="min-w-0">
            {props.title && <h2 className="text-[13px] font-semibold tracking-tight text-ink">{props.title}</h2>}
            {props.description && <p className="mt-0.5 text-[12px] text-ink-dim">{props.description}</p>}
          </div>
          {props.aside}
        </header>
      )}
      <div className={props.flush ? "" : props.compact ? "p-3" : "p-4"}>{props.children}</div>
    </section>
  );
}

export function Badge(props: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={`inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[11px] font-medium ${
        toneSoft[props.tone ?? "dim"]
      } ${props.className ?? ""}`}
    >
      {props.dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {props.children}
    </span>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "primary" | "accent" | "ghost" | "subtle" | "danger";
  busy?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  arrow?: boolean;
  title?: string;
}) {
  const tone = props.tone ?? "primary";
  const tones = {
    primary: "bg-night text-night-ink hover:bg-night/85",
    accent: "bg-accent text-accent-ink hover:brightness-110",
    ghost: "border border-edge bg-panel text-ink hover:border-edge-strong hover:bg-panel-2",
    subtle: "text-ink-dim hover:bg-ink/[0.06] hover:text-ink",
    danger: "border border-edge bg-panel text-danger hover:border-danger/40 hover:bg-danger-soft",
  }[tone];
  const size = props.size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[13px]";
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled || props.busy}
      title={props.title}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${size} ${tones} ${props.className ?? ""}`}
    >
      {props.busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {props.children}
      {props.arrow && !props.busy && <ArrowUpRight className="h-3.5 w-3.5" />}
    </button>
  );
}

export function IconButton(props: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  className?: string;
  active?: boolean;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
        props.active ? "bg-ink/[0.08] text-ink" : "text-ink-dim hover:bg-ink/[0.06] hover:text-ink"
      } ${props.className ?? ""}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink">{props.label}</span>
      {props.children}
      {props.hint && <span className="mt-1.5 block text-[12px] text-ink-dim">{props.hint}</span>}
    </label>
  );
}

const fieldCls =
  "w-full rounded-lg border border-edge bg-panel px-2.5 text-[13px] text-ink placeholder:text-ink-faint transition duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:opacity-50";

export function Input(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  autoComplete?: string;
  mono?: boolean;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      autoComplete={props.autoComplete}
      disabled={props.disabled}
      maxLength={props.maxLength}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && props.onEnter) {
          e.preventDefault();
          props.onEnter();
        }
      }}
      className={`${fieldCls} h-9 ${props.mono ? "font-mono text-[12.5px]" : ""} ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <textarea
      value={props.value}
      rows={props.rows ?? 5}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      className={`${fieldCls} resize-y py-2 ${props.mono ? "font-mono text-[12.5px]" : ""} ${props.className ?? ""}`}
    />
  );
}

export function Toggle(props: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        disabled={props.disabled}
        onClick={() => props.onChange(!props.checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
          props.checked ? "bg-accent" : "bg-ink/20"
        }`}
      >
        <span
          className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            props.checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
      {props.label && <span className="text-[13px] font-medium text-ink">{props.label}</span>}
    </label>
  );
}

/** Segmented control. */
export function Tabs(props: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return (
    <div role="tablist" className="inline-flex gap-0.5 rounded-lg bg-panel-2 p-0.5">
      {props.tabs.map((t, index) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={t === props.active}
          tabIndex={t === props.active ? 0 : -1}
          onClick={() => props.onChange(t)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const delta = event.key === "ArrowRight" ? 1 : -1;
            const next = (index + delta + props.tabs.length) % props.tabs.length;
            props.onChange(props.tabs[next]);
          }}
          className={`h-7 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors ${
            t === props.active ? "bg-panel text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-dim hover:text-ink"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export function Spinner(props: { size?: number; className?: string; label?: string }) {
  if (props.label !== undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-ink-dim">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[13px]">{props.label || "Loading…"}</span>
      </div>
    );
  }
  const size = props.size ?? 16;
  return (
    <span
      aria-label="loading"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${props.className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}

export function Skeleton(props: { className?: string }) {
  return <span className={`skeleton block ${props.className ?? "h-4 w-full"}`} aria-hidden />;
}

export function EmptyState(props: { title: string; hint?: string; action?: ReactNode; tone?: Tone }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-edge px-6 py-8 text-center">
      <p className={`text-[13px] font-semibold ${props.tone ? toneText[props.tone] : "text-ink"}`}>{props.title}</p>
      {props.hint && <p className="max-w-sm text-[12.5px] text-ink-dim">{props.hint}</p>}
      {props.action && <div className="mt-2.5">{props.action}</div>}
    </div>
  );
}

/** One tile of a `.tiles` grid: a label, a number, a note. */
export function Stat(props: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ComponentType<{ className?: string }>;
}) {
  const Icon = props.icon;
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-[12px] text-ink-dim">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {props.label}
      </span>
      <span className={`tnum text-[20px] font-semibold leading-tight tracking-tight ${props.tone ? toneText[props.tone] : "text-ink"}`}>
        {props.value}
      </span>
      {props.sub && <span className="truncate text-[12px] text-ink-dim">{props.sub}</span>}
    </div>
  );
}

/** Initials circle with a deterministic muted background. */
export function Avatar(props: { name: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const name = (props.name ?? "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  let initials = "";
  if (parts.length >= 2) initials = (parts[0][0] + parts[1][0]).toUpperCase();
  else if (parts.length === 1) initials = parts[0].slice(0, 2).toUpperCase();

  const palette = [
    "bg-accent-soft text-accent",
    "bg-violet-soft text-violet",
    "bg-ok-soft text-ok",
    "bg-warn-soft text-warn",
    "bg-panel-2 text-ink",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const cls = palette[Math.abs(hash) % palette.length];
  const dims = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-[12px]",
    lg: "h-14 w-14 text-[17px]",
  }[props.size ?? "sm"];
  const icon = { xs: "h-3 w-3", sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-6 w-6" }[props.size ?? "sm"];
  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight ${dims} ${cls}`}
    >
      {initials || <User className={icon} />}
    </span>
  );
}

/** Remaining-quota bar. `percent` null = unknown (renders hatched). */
export function Progress(props: { percent: number | null; tone?: Tone; className?: string }) {
  const tone = props.tone ?? "accent";
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08] ${props.className ?? ""}`}>
      {props.percent === null ? (
        <div className="h-full w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,color-mix(in_srgb,var(--color-ink)_14%,transparent)_3px,color-mix(in_srgb,var(--color-ink)_14%,transparent)_6px)]" />
      ) : (
        <div
          className={`bar-fill h-full rounded-full ${toneBar[tone]}`}
          style={{ width: `${Math.max(2, Math.min(100, props.percent))}%` }}
        />
      )}
    </div>
  );
}

export function quotaTone(percent: number | null): Tone {
  if (percent === null) return "dim";
  if (percent <= 0) return "danger";
  if (percent < 25) return "warn";
  return "ok";
}

/** Plain text with its https links made clickable, shown by host name so a
 *  long sign-in URL does not swallow the sentence around it. */
export function LinkText(props: { text: string }) {
  const parts = props.text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!/^https?:\/\//.test(part)) return <Fragment key={i}>{part}</Fragment>;
        const clean = part.replace(/[.,;:)]+$/, "");
        let label = clean;
        try {
          label = new URL(clean).hostname;
        } catch {
          /* keep the raw text */
        }
        return (
          <Fragment key={i}>
            <a href={clean} target="_blank" rel="noreferrer noopener" className="font-medium underline underline-offset-2">
              {label}
            </a>
            {part.slice(clean.length)}
          </Fragment>
        );
      })}
    </>
  );
}

export function Notice(props: { tone: Tone; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-[13px] ${toneSoft[props.tone]}`}>
      <div className="min-w-0 leading-relaxed">{props.children}</div>
      {props.onClose && (
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function Code(props: { children: string; className?: string }) {
  return (
    <pre
      className={`max-w-full overflow-x-auto rounded-lg bg-code p-3.5 text-[12px] leading-relaxed text-[#e6e8eb] ${props.className ?? ""}`}
    >
      <code>{props.children}</code>
    </pre>
  );
}

/** Modal with a focus trap, scroll lock and an exit animation. Anchored near
 *  the top so async content can't re-centre it while you read. */
export function Modal(props: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const rendered = usePresence(props.open);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;

  useEffect(() => {
    if (!props.open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlockScroll = lockPageScroll();
    const focusTimer = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();
      previousFocus?.focus({ preventScroll: true });
    };
  }, [props.open]);

  if (!rendered) return null;
  return (
    <div
      className={`${
        props.open ? "backdrop-in" : "backdrop-out pointer-events-none"
      } fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-[10vh] sm:p-4 sm:pt-[12vh]`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && props.open) props.onClose();
      }}
      aria-hidden={!props.open}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${
          props.open ? "modal-in" : "modal-out"
        } flex max-h-[min(78dvh,52rem)] w-full flex-col overflow-hidden rounded-xl border border-edge bg-panel shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)] ${
          props.wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-edge px-5 py-3.5">
          <h3 id={titleId} className="text-[14px] font-semibold tracking-tight">
            {props.title}
          </h3>
          <button
            ref={closeRef}
            onClick={props.onClose}
            className="rounded-md p-1 text-ink-dim transition-colors hover:bg-ink/[0.06] hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="gutter-stable min-h-0 overflow-y-auto overscroll-contain p-5">{props.children}</div>
      </div>
    </div>
  );
}
