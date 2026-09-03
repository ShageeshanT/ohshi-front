/**
 * Model dropdown for the composer. The famous models sit at the top; the rest
 * hide behind "Other models". Each row carries the live remaining quota of the
 * connected Google account, kept deliberately small.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import type { ChatModelsPayload, ModelFamily } from "../lib/chat";
import { countdown, timeAgo } from "../lib/api";
import { effortLabel, familyName, modelLabel, routeLabel, splitPopular } from "../lib/chat";
import { vendorLogo } from "./logos";
import { Spinner, quotaTone, toneTextClass } from "./ui";

export default function ModelPicker(props: {
  models: ChatModelsPayload | null;
  value: string;
  onChange: (id: string) => void;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showOther, setShowOther] = useState(false);
  // Where the menu fits. The composer sits mid-screen on the landing page, so a
  // fixed `bottom-full` menu runs off the top — measure the room on each side,
  // open into the larger one, and cap the height to it.
  const [placement, setPlacement] = useState<{ up: boolean; maxHeight: number }>({
    up: true,
    maxHeight: 400,
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const refresh = () => {
    setRefreshing(true);
    props.onRefresh().finally(() => setRefreshing(false));
  };

  const MARGIN = 16;
  const IDEAL = 400;
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const above = rect.top - MARGIN;
      const below = window.innerHeight - rect.bottom - MARGIN;
      const up = above >= Math.min(IDEAL, below) || above > below;
      setPlacement({ up, maxHeight: Math.max(240, Math.min(IDEAL, up ? above : below)) });
    }
    setOpen(true);
  };

  const pick = (id: string) => {
    props.onChange(id);
    setOpen(false);
  };

  const m = props.models;
  const { popular, other } = splitPopular(m?.families ?? [], m?.popular ?? null);
  const selectedInOther = other.some((f) => f.variants.some((v) => v.id === props.value));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={props.disabled}
        onClick={toggle}
        className="flex h-7 max-w-[200px] items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-ink-dim transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{modelLabel(m, props.value)}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`pop-in absolute z-30 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-edge bg-panel shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)] ${
            placement.up ? "bottom-full mb-2" : "top-full mt-2"
          } ${props.align === "right" ? "right-0" : "left-0"}`}
          style={{ maxHeight: placement.maxHeight }}
          role="listbox"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-edge px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[11.5px] text-ink-dim">
                {m?.connected
                  ? `${routeLabel(m)}${
                      m.quotaAvailable && m.fetchedMs
                        ? `, quota ${timeAgo(m.fetchedMs)}`
                        : m.fetchedMs
                          ? `, list ${timeAgo(m.fetchedMs)}`
                          : ""
                    }`
                  : "Built-in catalog. Add a Gemini or DeepSeek API key, or connect a Google or ChatGPT account"}
              </p>
              {m?.error && <p className="mt-0.5 text-[11.5px] text-warn">{m.error}</p>}
            </div>
            {m?.connected && (
              <button
                type="button"
                onClick={refresh}
                className="shrink-0 rounded-md p-1 text-ink-dim transition-colors hover:bg-ink/[0.06] hover:text-ink"
                aria-label="Refresh models"
              >
                {refreshing ? <Spinner size={12} /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          <div className="gutter-stable min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {!m ? (
              <div className="flex justify-center py-6 text-ink-dim">
                <Spinner />
              </div>
            ) : (
              <>
                {popular.map((f) => (
                  <FamilyRow key={f.id} family={f} value={props.value} onPick={pick} />
                ))}

                {other.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowOther((v) => !v)}
                      className="mt-1 flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium text-ink-dim transition-colors hover:bg-ink/[0.05] hover:text-ink"
                    >
                      {showOther || selectedInOther ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      Other models ({other.length})
                    </button>
                    {(showOther || selectedInOther) &&
                      other.map((f) => <FamilyRow key={f.id} family={f} value={props.value} onPick={pick} />)}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FamilyRow(props: { family: ModelFamily; value: string; onPick: (id: string) => void }) {
  const f = props.family;
  const tone = quotaTone(f.remainingPercent);
  const Logo = vendorLogo(f.vendor);
  const selectedHere = f.variants.some((v) => v.id === props.value);
  const single = f.variants.length === 1;

  return (
    <div className={`rounded-md px-2 py-1.5 ${selectedHere ? "bg-ink/[0.06]" : "hover:bg-ink/[0.04]"}`}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={single && f.variants[0].exhausted}
          onClick={() => single && props.onPick(f.variants[0].id)}
          className={`flex min-w-0 items-center gap-2 text-left ${single ? "flex-1" : "cursor-default"}`}
        >
          <Logo className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
          <span className="truncate text-[12.5px] font-medium text-ink">{familyName(f)}</span>
          {single && props.value === f.variants[0].id && <Check className="h-3.5 w-3.5 shrink-0 text-ink" />}
        </button>
        <span className={`tnum shrink-0 text-[11.5px] font-medium ${toneTextClass(tone)}`}>
          {f.remainingPercent === null
            ? ""
            : f.exhausted
              ? `out${f.resetMs ? `, ${countdown(f.resetMs)}` : ""}`
              : `${f.remainingPercent}%`}
        </span>
      </div>
      {!single && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {f.variants.map((v) => {
            const active = v.id === props.value;
            return (
              <button
                key={v.id}
                type="button"
                disabled={v.exhausted}
                onClick={() => props.onPick(v.id)}
                title={v.id}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-ink text-panel"
                    : v.exhausted
                      ? "cursor-not-allowed bg-danger-soft text-danger/70 line-through"
                      : "bg-ink/[0.06] text-ink-dim hover:bg-ink/[0.12] hover:text-ink"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
                {effortLabel(v.effort) || v.displayName}
                {v.remainingPercent !== null && v.remainingPercent !== f.remainingPercent ? ` ${v.remainingPercent}%` : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
