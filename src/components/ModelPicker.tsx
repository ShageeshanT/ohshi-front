/**
 * Model dropdown for the composer. Lists the connected Google account's live
 * catalog grouped by family, with remaining quota and effort variants.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import type { ChatModelsPayload, ModelFamily } from "../lib/chat";
import { countdown, timeAgo } from "../lib/api";
import { effortLabel, familyName, modelLabel } from "../lib/chat";
import { Progress, Spinner, quotaTone } from "./ui";

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

  const m = props.models;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-[220px] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-panel-2 disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{modelLabel(m, props.value)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-dim" />
      </button>

      {open && (
        <div
          className={`absolute bottom-full z-30 mb-2 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-edge bg-panel shadow-2xl ${
            props.align === "left" ? "left-0" : "right-0"
          }`}
          role="listbox"
        >
          <div className="flex items-start justify-between gap-2 border-b border-edge px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {m?.connected ? "Models on your Google account" : "Built-in catalog"}
              </p>
              <p className="truncate text-xs text-ink-dim">
                {m?.connected
                  ? `${m.email}${m.quotaAvailable && m.fetchedMs ? ` · quota ${timeAgo(m.fetchedMs)}` : ""}`
                  : "Connect a Google account to see live availability."}
              </p>
              {m?.error && <p className="mt-1 text-xs text-warn">{m.error}</p>}
            </div>
            {m?.connected && (
              <button
                type="button"
                onClick={refresh}
                className="rounded-lg p-1.5 text-ink-dim hover:bg-panel-2"
                aria-label="Refresh models"
              >
                {refreshing ? <Spinner size={14} /> : <RefreshCw className="h-4 w-4" />}
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto p-2">
            {!m ? (
              <div className="flex justify-center py-6 text-ink-dim">
                <Spinner />
              </div>
            ) : (
              m.families.map((family) => (
                <FamilyRow
                  key={family.id}
                  family={family}
                  value={props.value}
                  onPick={(id) => {
                    props.onChange(id);
                    setOpen(false);
                  }}
                />
              ))
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
  const selectedHere = f.variants.some((v) => v.id === props.value);
  return (
    <div className={`rounded-xl px-3 py-2.5 ${selectedHere ? "bg-panel-2/80" : "hover:bg-panel-2/50"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{familyName(f)}</span>
        <span className={`shrink-0 text-[11px] font-medium ${tone === "dim" ? "text-ink-dim" : `text-${tone}`}`}>
          {f.remainingPercent === null
            ? f.known
              ? ""
              : "unknown"
            : f.exhausted
              ? `out of quota${f.resetMs ? ` · resets ${countdown(f.resetMs)}` : ""}`
              : `${f.remainingPercent}% left`}
        </span>
      </div>
      {f.remainingPercent !== null && (
        <div className="mt-1.5">
          <Progress percent={f.remainingPercent} tone={tone} />
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {f.variants.map((v) => {
          const active = v.id === props.value;
          const label = v.effort ? effortLabel(v.effort) : f.variants.length > 1 ? v.displayName : "Select";
          const pct =
            v.remainingPercent !== null && v.remainingPercent !== f.remainingPercent
              ? ` · ${v.remainingPercent}%`
              : "";
          return (
            <button
              key={v.id}
              type="button"
              disabled={v.exhausted}
              onClick={() => props.onPick(v.id)}
              title={v.id}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-night text-white"
                  : v.exhausted
                    ? "cursor-not-allowed bg-danger-soft text-danger/70 line-through"
                    : "bg-panel-2 text-ink hover:bg-edge"
              }`}
            >
              {active && <Check className="h-3 w-3" />}
              {label}
              {pct}
            </button>
          );
        })}
      </div>
    </div>
  );
}
