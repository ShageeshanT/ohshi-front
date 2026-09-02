/** Remaining quota per model family for one Google account, as a grid of
 *  small bars. Used on the Models page, and in miniature on the Overview. */

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { countdown, timeAgo } from "../lib/api";
import type { FamilyQuota, QuotaState } from "../lib/workspace";
import { vendorLogo } from "./logos";
import { Button, EmptyState, Notice, Progress, Skeleton, quotaTone, toneTextClass } from "./ui";

export function QuotaGrid(props: { quota: QuotaState; onRefresh: () => void; columns?: "two" | "three" }) {
  const { snapshot, error, loading } = props.quota;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const exhaustedCount = snapshot?.summary.exhausted.length ?? 0;
  const cols = props.columns === "two" ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-ink-dim">
          {snapshot
            ? `Live from Google, ${snapshot.endpointLabel} endpoint, ${timeAgo(snapshot.fetchedMs)}${
                snapshot.cached ? ", cached" : ""
              }${exhaustedCount ? `, ${exhaustedCount} model${exhaustedCount > 1 ? "s" : ""} out of quota` : ""}`
            : loading
              ? "Reading your quota from Google…"
              : "Quota unavailable"}
        </p>
        <Button size="sm" tone="ghost" busy={loading} onClick={props.onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-3">
          <Notice tone="warn">
            {error}
            {snapshot ? " Showing the last reading." : ""}
          </Notice>
        </div>
      )}

      {!snapshot ? (
        loading ? (
          <div className={`grid gap-2 ${cols}`}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-edge px-3 py-2.5">
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="mt-2.5 h-1.5 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No quota reading yet" hint="Hit Refresh to ask Google again." />
        )
      ) : snapshot.families.length === 0 ? (
        <EmptyState title="Google listed no models for this account" hint="The plan may not include Antigravity yet." />
      ) : (
        <div className={`grid gap-2 ${cols}`}>
          {snapshot.families.map((f) => (
            <FamilyRow key={f.id} family={f} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FamilyRow(props: { family: FamilyQuota; now: number; compact?: boolean }) {
  const f = props.family;
  const tone = quotaTone(f.remainingPercent);
  const Logo = vendorLogo(f.vendor);
  const reset = f.resetMs ? countdown(f.resetMs, props.now) : "";

  return (
    <div className={`rounded-lg border border-edge transition-colors hover:border-edge-strong ${props.compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Logo className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
          <span className="truncate text-[12.5px] font-medium">{f.known ? f.label : (f.variants[0]?.displayName ?? f.id)}</span>
        </span>
        <span className={`tnum shrink-0 text-[12px] font-medium ${toneTextClass(tone)}`}>
          {f.remainingPercent === null ? "Unknown" : f.exhausted ? "out of quota" : `${f.remainingPercent}%`}
          {reset && !props.compact && <span className="ml-1 font-normal text-ink-dim">{reset}</span>}
        </span>
      </div>
      <div className="mt-2">
        <Progress percent={f.remainingPercent} tone={tone} className="h-1" />
      </div>
      {!props.compact && f.variants.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {f.variants.map((v) => (
            <span
              key={v.id}
              title={`${v.id}${v.resetMs ? `, resets ${countdown(v.resetMs, props.now)}` : ""}`}
              className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${
                v.exhausted ? "bg-danger-soft text-danger line-through" : "bg-ink/[0.05] text-ink-dim"
              }`}
            >
              {v.effort || v.id}
              {v.remainingPercent !== null && ` ${v.remainingPercent}%`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
