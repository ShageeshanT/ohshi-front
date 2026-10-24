/**
 * The admins' Uncensored model switch, in the sidebar's Operator section.
 *
 * Off → Starting (the Kaggle run boots and loads the model, two or three
 * minutes) → On with the time left → Off again when it is switched off or its
 * twenty minutes are up. Polls while the tab is visible — every few seconds
 * while it starts, less often otherwise — and counts down locally in between.
 * On the 56px rail it is the icon with a status dot.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { VenetianMask } from "lucide-react";
import { friendly } from "../lib/api";
import {
  announceUncensored,
  getUncensored,
  startUncensored,
  stopUncensored,
  timeLeft,
  type UncensoredState,
  type UncensoredStatus,
} from "../lib/uncensored";
import { Spinner, Toggle } from "./ui";

const POLL_MS: Record<UncensoredStatus, number> = { off: 30_000, starting: 4_000, on: 15_000 };

function describe(state: UncensoredState | null, leftMs: number): { text: string; tone: string } {
  if (!state) return { text: "Checking…", tone: "text-ink-faint" };
  if (!state.configured) return { text: "Needs a Kaggle account on the server", tone: "text-ink-faint" };
  if (state.status === "starting") return { text: "Starting on Kaggle · 2–3 min", tone: "text-warn" };
  if (state.status === "on") return { text: `On · ${timeLeft(leftMs)} left`, tone: "text-ok" };
  if (state.endedReason === "failed" || state.endedReason === "lost") {
    return { text: state.message || "The Kaggle run stopped.", tone: "text-danger" };
  }
  if (state.endedReason === "time") return { text: state.message || "Time is up.", tone: "text-ink-faint" };
  return { text: `Off · ${state.minutes} minutes when on`, tone: "text-ink-faint" };
}

export default function UncensoredSwitch(props: { collapsed: boolean }) {
  const [state, setState] = useState<UncensoredState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const skewRef = useRef(0); // server clock minus ours
  const lastStatusRef = useRef<UncensoredStatus | null>(null);
  const wantSelectRef = useRef(false);

  const apply = useCallback((next: UncensoredState) => {
    skewRef.current = next.serverMs - Date.now();
    setNow(Date.now());
    setState(next);
    const previous = lastStatusRef.current;
    lastStatusRef.current = next.status;
    if (previous !== null && previous !== next.status) {
      announceUncensored({ status: next.status, select: next.status === "on" && wantSelectRef.current });
      if (next.status !== "starting") wantSelectRef.current = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await getUncensored());
    } catch (e) {
      setError(friendly(e));
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
    const onVisibility = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  const status = state?.status ?? "off";

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_MS[status]);
    return () => window.clearInterval(id);
  }, [refresh, status]);

  useEffect(() => {
    if (status === "off") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const toggle = async () => {
    if (!state?.configured || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (state.status === "off") {
        wantSelectRef.current = true;
        apply(await startUncensored());
      } else {
        apply(await stopUncensored());
      }
    } catch (e) {
      wantSelectRef.current = false;
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const leftMs = state?.endsMs ? state.endsMs - (now + skewRef.current) : 0;
  const line = error ? { text: error, tone: "text-danger" } : describe(state, leftMs);
  const on = status === "on";
  const requested = status !== "off";
  const disabled = !state?.configured || busy;

  if (props.collapsed) {
    return (
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={disabled}
        title={`Uncensored — ${line.text}`}
        aria-label={`Uncensored model: ${line.text}. ${requested ? "Switch off" : "Switch on"}`}
        className="relative mx-auto flex h-9 w-9 items-center justify-center rounded-md text-ink-dim transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-60"
      >
        <VenetianMask className={`h-4 w-4 ${on ? "text-ok" : ""}`} />
        {requested && (
          <span
            className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-surface ${
              on ? "bg-ok" : "animate-pulse bg-warn"
            }`}
          />
        )}
      </button>
    );
  }

  return (
    <div className="w-full px-2.5 py-[5px]" title="Admins only: the Uncensored model on a Kaggle GPU">
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-dim">
        <VenetianMask className={`h-4 w-4 shrink-0 ${on ? "text-ok" : ""}`} />
        <span className="min-w-0 flex-1 truncate">Uncensored</span>
        {(busy || status === "starting") && <Spinner size={11} className="text-ink-faint" />}
        <Toggle checked={requested} onChange={() => void toggle()} disabled={disabled} />
      </div>
      <p className={`mt-0.5 line-clamp-2 pl-6 text-[11px] leading-snug ${line.tone}`} aria-live="polite">
        {line.text}
      </p>
    </div>
  );
}
