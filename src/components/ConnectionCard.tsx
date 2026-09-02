/** One connected Google account on the Connected accounts page: identity,
 *  health, where its calls run, and a one-line quota summary that points to
 *  the Models page for the full grid. */

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Laptop, Plug, Star, Trash2, Zap } from "lucide-react";
import type { RunnerStatus } from "./ConnectorCard";
import { friendly, post, timeAgo } from "../lib/api";
import {
  executionLine,
  healthLine,
  type Connection,
  type ConnectionTestResult,
  type ExecuteMode,
  type QuotaState,
} from "../lib/workspace";
import { GoogleLogo, vendorLogo } from "./logos";
import { Badge, Button, Card, Toggle, quotaTone, toneTextClass } from "./ui";

export function ConnectionCard(props: {
  connection: Connection;
  quota: QuotaState;
  runner: RunnerStatus | null;
  /** Hidden for the only account unless a Gemini key currently holds the route. */
  canMakeDefault: boolean;
  onDisconnect: () => void;
  onMakeDefault: () => void;
  onReconnect: () => void;
  onExecuteMode: (mode: ExecuteMode) => void;
  onTested: () => void;
}) {
  const c = props.connection;
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<ConnectionTestResult | null>(null);
  const line = healthLine(c, testing);
  const connected = c.status === "active";
  const preferLocal = c.executeMode === "prefer_local";
  const execution = executionLine(c, props.runner);
  // The backend sets this exact sentence (and only this) when a prefer_local
  // call had to run on Ohshi's servers; health stays green, so say it quietly.
  const fellBack =
    preferLocal && !!props.runner && !!c.health?.lastError && c.health.lastError === props.runner.fallbackMessage;
  const snapshot = props.quota.snapshot;

  const runTest = () => {
    setTesting(true);
    setTest(null);
    post<ConnectionTestResult>(`/api/google/connections/${c.id}/test`)
      .then(setTest)
      .catch((e) => setTest({ ok: false, latencyMs: 0, model: "", error: friendly(e) }))
      .finally(() => {
        setTesting(false);
        props.onTested();
      });
  };

  return (
    <Card flush className={c.isDefault ? "ring-1 ring-accent/30" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-edge bg-panel">
            <GoogleLogo className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold">{c.email}</span>
              {c.isDefault && (
                <Badge tone="accent">
                  <Star className="h-3 w-3" /> Default
                </Badge>
              )}
              {c.locked && <Badge tone="warn">Locked on your plan</Badge>}
              {connected ? (
                c.health?.status === "error" ? (
                  <Badge tone="danger" dot>
                    Not answering
                  </Badge>
                ) : (
                  <Badge tone="ok" dot>
                    Connected
                  </Badge>
                )
              ) : (
                <Badge tone="danger" dot>
                  Needs reconnect
                </Badge>
              )}
              {c.tier && <Badge>{c.tier === "free" ? "Code Assist free tier" : `${c.tier} tier`}</Badge>}
            </div>
            <p className={`mt-1 text-[12px] ${toneTextClass(line.tone)}`}>{line.text}</p>
            {test && !testing && (
              <p className={`mt-0.5 text-[12px] ${test.ok ? "text-ok" : "text-danger"}`}>
                {test.ok
                  ? `Test passed, “${test.reply}” from ${test.model} via ${test.endpointLabel} in ${(test.latencyMs / 1000).toFixed(1)}s`
                  : `Test failed, ${test.error}${test.tried?.length ? ` (tried ${test.tried.join(", ")})` : ""}`}
              </p>
            )}
            <p className="mt-0.5 text-[12px] text-ink-dim">
              Connected {timeAgo(c.connectedMs)}, project {c.projectId || "pending"}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-1.5 lg:w-auto">
          {connected ? (
            <Button size="sm" tone="ghost" busy={testing} onClick={runTest}>
              <Zap className="h-3.5 w-3.5" /> Test
            </Button>
          ) : (
            <Button size="sm" onClick={props.onReconnect}>
              <Plug className="h-3.5 w-3.5" /> Reconnect
            </Button>
          )}
          {props.canMakeDefault && connected && (
            <Button size="sm" tone="ghost" onClick={props.onMakeDefault}>
              <Star className="h-3.5 w-3.5" /> Make default
            </Button>
          )}
          <Button size="sm" tone="danger" onClick={props.onDisconnect}>
            <Trash2 className="h-3.5 w-3.5" /> Disconnect
          </Button>
        </div>
      </div>

      {connected && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge bg-surface px-4 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Toggle
              checked={preferLocal}
              onChange={(next) => props.onExecuteMode(next ? "prefer_local" : "cloud")}
              label="Run on my machine"
            />
            <span className={`text-[12px] ${toneTextClass(execution.tone)}`}>{execution.text}</span>
            {fellBack && (
              <span className="text-[12px] text-warn">The last call ran on Ohshi's servers because the connector was offline.</span>
            )}
          </div>
          <a href="#connector" className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-ink-dim hover:text-ink">
            <Laptop className="h-3.5 w-3.5" /> Connector
          </a>
        </div>
      )}

      {connected && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-edge px-4 py-2.5">
          <span className="text-[12px] text-ink-dim">Quota</span>
          {snapshot ? (
            <>
              {snapshot.families.slice(0, 4).map((f) => {
                const Logo = vendorLogo(f.vendor);
                const tone = quotaTone(f.remainingPercent);
                return (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1 rounded-md border border-edge px-1.5 py-0.5 text-[11.5px]"
                  >
                    <Logo className="h-3 w-3 text-ink-dim" />
                    <span className="max-w-[9rem] truncate">{f.known ? f.label : (f.variants[0]?.displayName ?? f.id)}</span>
                    <span className={`tnum font-medium ${toneTextClass(tone)}`}>
                      {f.remainingPercent === null ? "?" : f.exhausted ? "out" : `${f.remainingPercent}%`}
                    </span>
                  </span>
                );
              })}
              {snapshot.families.length > 4 && (
                <span className="text-[11.5px] text-ink-dim">+{snapshot.families.length - 4} more</span>
              )}
            </>
          ) : (
            <span className="text-[12px] text-ink-dim">{props.quota.loading ? "Reading from Google…" : "unavailable right now"}</span>
          )}
          <Link to="/app/models" className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
            Models <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </Card>
  );
}
