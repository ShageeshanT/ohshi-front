import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type Tone = "accent" | "ok" | "warn" | "danger" | "dim";

const toneText: Record<Tone, string> = {
  accent: "text-accent",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
  dim: "text-ink-dim",
};

const toneBadge: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  dim: "bg-panel-2 text-ink-dim",
};

const toneBar: Record<Tone, string> = {
  accent: "bg-accent",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  dim: "bg-ink-dim",
};

export function Badge(props: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${toneBadge[props.tone ?? "dim"]} ${props.className ?? ""}`}
    >
      {props.children}
    </span>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "primary" | "ghost" | "danger";
  busy?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const tone = props.tone ?? "primary";
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
  const size = props.size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  const tones = {
    primary: "bg-night text-white hover:bg-black shadow-sm",
    ghost: "bg-panel-2 text-ink hover:bg-edge",
    danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
  } as const;
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled || props.busy}
      className={`${base} ${size} ${tones[tone]} ${props.className ?? ""}`}
    >
      {props.busy && <Spinner size={14} />}
      {props.children}
    </button>
  );
}

export function Card(props: { children: ReactNode; className?: string; title?: ReactNode; aside?: ReactNode }) {
  return (
    <section className={`panel p-5 ${props.className ?? ""}`}>
      {(props.title || props.aside) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          {props.title && <h2 className="text-base font-semibold">{props.title}</h2>}
          {props.aside}
        </header>
      )}
      {props.children}
    </section>
  );
}

export function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{props.label}</span>
      {props.children}
      {props.hint && <span className="block text-xs text-ink-dim">{props.hint}</span>}
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
}) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      autoComplete={props.autoComplete}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && props.onEnter) {
          e.preventDefault();
          props.onEnter();
        }
      }}
      className={`w-full rounded-xl border border-edge bg-panel px-3.5 py-2.5 text-sm placeholder:text-ink-dim/70 focus:border-accent ${props.mono ? "mono" : ""}`}
    />
  );
}

export function Spinner(props: { size?: number; className?: string }) {
  const size = props.size ?? 18;
  return (
    <span
      aria-label="loading"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${props.className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}

export function EmptyState(props: { title: string; hint?: string; action?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-dashed border-edge bg-panel-2/60 p-6 text-center">
      <p className={`text-sm font-semibold ${toneText[props.tone ?? "dim"]}`}>{props.title}</p>
      {props.hint && <p className="mt-1 text-sm text-ink-dim">{props.hint}</p>}
      {props.action && <div className="mt-4 flex justify-center">{props.action}</div>}
    </div>
  );
}

export function StatChip(props: { label: string; value: ReactNode; sub?: string; tone?: Tone }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim">{props.label}</p>
      <p className={`mt-1 text-2xl font-semibold ${props.tone ? toneText[props.tone] : ""}`}>{props.value}</p>
      {props.sub && <p className="text-xs text-ink-dim">{props.sub}</p>}
    </div>
  );
}

/** Remaining-quota bar. `percent` null = unknown (renders hatched). */
export function Progress(props: { percent: number | null; tone?: Tone }) {
  const tone = props.tone ?? "accent";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-panel-2">
      {props.percent === null ? (
        <div className="h-full w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgb(0_0_0/0.08)_4px,rgb(0_0_0/0.08)_8px)]" />
      ) : (
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${toneBar[tone]}`}
          style={{ width: `${Math.max(0, Math.min(100, props.percent))}%` }}
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

export function Modal(props: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);
  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="rise-in w-full max-w-lg rounded-2xl bg-panel p-6 shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{props.title}</h3>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg p-1.5 text-ink-dim hover:bg-panel-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {props.children}
      </div>
    </div>
  );
}

export function Notice(props: { tone: Tone; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${toneBadge[props.tone]}`}>
      <div className="normal-case tracking-normal">{props.children}</div>
      {props.onClose && (
        <button type="button" onClick={props.onClose} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Code(props: { children: string; className?: string }) {
  return (
    <pre className={`overflow-x-auto rounded-xl bg-night p-4 text-xs leading-relaxed text-white ${props.className ?? ""}`}>
      <code>{props.children}</code>
    </pre>
  );
}
