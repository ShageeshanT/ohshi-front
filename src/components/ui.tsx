/** Shared UI kit — white canvas, soft slabs, night capsules, full-radius
 *  geometry, buttery expo easing. */

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Loader2, X } from "lucide-react";

export type Tone = "accent" | "ok" | "warn" | "danger" | "violet" | "dim";

const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

const toneText: Record<Tone, string> = {
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  violet: "text-violet",
  dim: "text-ink-dim",
};

const toneSoft: Record<Tone, string> = {
  accent: "bg-accent/15 text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  violet: "bg-violet-soft text-violet",
  dim: "bg-white/[0.07] text-ink-dim",
};

const toneBar: Record<Tone, string> = {
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  violet: "bg-violet",
  dim: "bg-ink-dim",
};

/** Keep an overlay mounted briefly after it closes so its exit animation can
 *  finish. The interaction layer is disabled by each consumer while exiting. */
export function usePresence(open: boolean, exitMs = 180): boolean {
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

/** Freeze the page behind an open overlay, and return the undo. The page
 *  scroller is `#main-content` (or the chat's own pane), not <body>, so
 *  locking body would be a no-op and a wheel over the backdrop would slide
 *  the page behind the fixed panel. */
export function lockPageScroll(): () => void {
  const target = document.getElementById("main-content") ?? document.body;
  const previous = target.style.overflowY;
  target.style.overflowY = "hidden";
  return () => {
    target.style.overflowY = previous;
  };
}

// ── primitives ───────────────────────────────────────────────────────────────

export function Card(props: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  aside?: ReactNode;
  /** Denser padding for space-tight surfaces. */
  compact?: boolean;
}) {
  return (
    <section className={`glass ${props.compact ? "p-4" : "p-5 sm:p-6"} ${props.className ?? ""}`}>
      {(props.title || props.aside) && (
        <header className={`${props.compact ? "mb-3" : "mb-5"} flex items-start justify-between gap-3`}>
          {props.title && (
            <h2 className={`${props.compact ? "text-sm" : "text-base"} font-bold tracking-tight text-ink`}>
              {props.title}
            </h2>
          )}
          {props.aside}
        </header>
      )}
      {props.children}
    </section>
  );
}

export function Badge(props: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
        toneSoft[props.tone ?? "dim"]
      } ${props.className ?? ""}`}
    >
      {props.children}
    </span>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "primary" | "accent" | "night" | "ghost" | "danger";
  busy?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  arrow?: boolean;
}) {
  const tone = props.tone ?? "primary";
  const tones = {
    primary:
      "bg-accent text-accent-ink hover:brightness-105 shadow-[0_2px_16px_-6px_rgb(241_255_92/0.5)] hover:shadow-[0_10px_26px_-8px_rgb(241_255_92/0.6)]",
    accent:
      "bg-accent text-accent-ink hover:brightness-105 shadow-[0_2px_16px_-6px_rgb(241_255_92/0.5)]",
    night: "bg-night text-ink border border-white/10 hover:bg-night/80",
    ghost: "border border-edge bg-panel-2 text-ink hover:bg-edge",
    danger: "bg-danger-soft text-danger hover:bg-danger hover:text-night",
  }[tone];
  const size = props.size === "sm" ? "px-3.5 py-1.5 text-xs" : "px-5 py-2.5 text-sm";
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled || props.busy}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-[transform,box-shadow,background-color,filter,opacity] duration-[250ms] ${EASE} hover:-translate-y-px active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${size} ${tones} ${props.className ?? ""}`}
    >
      {props.busy && <Loader2 className={props.size === "sm" ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} />}
      {props.children}
      {props.arrow && !props.busy && <ArrowUpRight className="h-4 w-4" />}
    </button>
  );
}

export function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
        {props.label}
      </span>
      {props.children}
      {props.hint && <span className="mt-1.5 block text-xs text-ink-dim/90">{props.hint}</span>}
    </label>
  );
}

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
}) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      autoComplete={props.autoComplete}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && props.onEnter) {
          e.preventDefault();
          props.onEnter();
        }
      }}
      className={`w-full rounded-full border border-edge bg-panel-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink-dim/60 transition duration-300 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10 disabled:opacity-50 ${
        props.mono ? "font-mono text-[13px]" : ""
      } ${props.className ?? ""}`}
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
      className={`w-full resize-y rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink placeholder:text-ink-dim/60 transition duration-300 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10 ${
        props.mono ? "font-mono text-[13px]" : ""
      } ${props.className ?? ""}`}
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
    <label className="inline-flex cursor-pointer select-none items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        disabled={props.disabled}
        onClick={() => props.onChange(!props.checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] disabled:opacity-50 ${
          props.checked ? "bg-accent" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full shadow transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            props.checked ? "left-[26px] bg-accent-ink" : "left-1 bg-white"
          }`}
        />
      </button>
      {props.label && <span className="text-sm font-medium text-ink">{props.label}</span>}
    </label>
  );
}

export function Tabs(props: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return (
    <div role="tablist" className="inline-flex gap-1 rounded-full bg-panel-2 p-1">
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
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            t === props.active ? "bg-accent text-accent-ink shadow-sm" : "text-ink-dim hover:text-ink"
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
      <div className="flex items-center justify-center gap-2 py-10 text-ink-dim">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">{props.label || "Loading…"}</span>
      </div>
    );
  }
  const size = props.size ?? 18;
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
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-edge bg-white/[0.02] px-6 py-10 text-center">
      <p className={`text-sm font-bold ${props.tone ? toneText[props.tone] : "text-ink"}`}>{props.title}</p>
      {props.hint && <p className="max-w-sm text-sm text-ink-dim">{props.hint}</p>}
      {props.action && <div className="mt-3">{props.action}</div>}
    </div>
  );
}

export function StatChip(props: { label: string; value: ReactNode; sub?: string; tone?: Tone }) {
  return (
    <div className="glass lift flex flex-col gap-0.5 px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">{props.label}</span>
      <span className={`text-xl font-extrabold tracking-tight ${props.tone ? toneText[props.tone] : "text-ink"}`}>
        {props.value}
      </span>
      {props.sub && <span className="text-[11px] text-ink-dim">{props.sub}</span>}
    </div>
  );
}

/** Initials circle with a deterministic on-brand background. */
export function Avatar(props: { name: string; size?: "sm" | "md" }) {
  const name = (props.name ?? "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  let initials = "";
  if (parts.length >= 2) initials = (parts[0][0] + parts[1][0]).toUpperCase();
  else if (parts.length === 1) initials = parts[0].slice(0, 2).toUpperCase();
  if (!initials) initials = "·";

  const palette = [
    "bg-accent text-accent-ink",
    "bg-violet-soft text-violet",
    "bg-ok-soft text-ok",
    "bg-warn-soft text-warn",
    "bg-white/10 text-ink",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const cls = palette[Math.abs(hash) % palette.length];
  const dims = props.size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight ${dims} ${cls}`}
    >
      {initials}
    </span>
  );
}

/** Remaining-quota bar. `percent` null = unknown (renders hatched). */
export function Progress(props: { percent: number | null; tone?: Tone; className?: string }) {
  const tone = props.tone ?? "accent";
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-white/[0.08] ${props.className ?? ""}`}>
      {props.percent === null ? (
        <div className="h-full w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgb(255_255_255/0.09)_4px,rgb(255_255_255/0.09)_8px)]" />
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

export function Notice(props: { tone: Tone; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${toneSoft[props.tone]}`}>
      <div className="normal-case tracking-normal">{props.children}</div>
      {props.onClose && (
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Code(props: { children: string; className?: string }) {
  return (
    <pre
      className={`overflow-x-auto rounded-2xl border border-white/8 bg-[#1b1f24] p-4 text-xs leading-relaxed text-white ${props.className ?? ""}`}
    >
      <code>{props.children}</code>
    </pre>
  );
}

/** Modal with a focus trap, scroll lock and an exit animation.
 *
 *  Anchored near the top (items-start), NOT centred: a centred panel
 *  re-centres itself on every content-height change, so each async status line
 *  that lands inside an open dialog moves every letter in it by half the delta.
 *  The outer card clips and only the body scrolls, so the scrollbar stays
 *  inside the rounded corners. */
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
    // preventScroll: focusing a control inside a freshly-mounted overlay
    // otherwise lets the browser scroll ancestors to reveal it — a one-shot
    // page jump at the exact moment the dialog appears.
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
      } fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 pt-[8vh] backdrop-blur-[3px] sm:p-4 sm:pt-[10vh]`}
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
        } flex max-h-[min(78dvh,52rem)] w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-panel shadow-2xl ${
          props.wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <h3 id={titleId} className="text-lg font-bold tracking-tight">
            {props.title}
          </h3>
          <button
            ref={closeRef}
            onClick={props.onClose}
            className="rounded-full p-2 text-ink-dim transition-colors hover:bg-white/10 hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {/* overscroll-contain: without it, scrolling past the end of the dialog
            body chains into the page and slides it behind the fixed panel. */}
        <div className="gutter-stable min-h-0 overflow-y-auto overscroll-contain pb-5 pl-5 pr-3 sm:pb-7 sm:pl-7 sm:pr-5">
          {props.children}
        </div>
      </div>
    </div>
  );
}
