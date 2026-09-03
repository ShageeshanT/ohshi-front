/** One connected ChatGPT account on the Accounts page: identity, plan, health,
 *  and the two rolling usage windows OpenAI reports (5-hour and weekly). */

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plug, Star, Trash2, Zap } from "lucide-react";
import { countdown, friendly, post, timeAgo } from "../lib/api";
import {
  chatgptHealthLine,
  windowName,
  type ChatGPTConnection,
  type ChatGPTUsageState,
  type ConnectionTestResult,
  type UsageWindow,
} from "../lib/workspace";
import { OpenAILogo } from "./logos";
import { Badge, Button, Card, LinkText, Progress, quotaTone, toneTextClass } from "./ui";

export function ChatGPTAccountCard(props: {
  connection: ChatGPTConnection;
  usage: ChatGPTUsageState;
  /** Hidden for the only source unless something else currently holds the route. */
  canMakeDefault: boolean;
  onDisconnect: () => void;
  onMakeDefault: () => void;
  onReconnect: () => void;
  onTested: () => void;
}) {
  const c = props.connection;
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<ConnectionTestResult | null>(null);
  const line = chatgptHealthLine(c, testing);
  const connected = c.status === "active";
  const usage = props.usage.usage;

  const runTest = () => {
    setTesting(true);
    setTest(null);
    post<ConnectionTestResult>(`/api/openai/connections/${c.id}/test`)
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
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-edge bg-panel text-ink">
            <OpenAILogo className="h-4 w-4" />
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
              {c.planLabel && <Badge>ChatGPT {c.planLabel}</Badge>}
            </div>
            <p className={`mt-1 text-[12px] ${toneTextClass(line.tone)}`}>
              <LinkText text={line.text} />
            </p>
            {test && !testing && (
              <p className={`mt-0.5 text-[12px] ${test.ok ? "text-ok" : "text-danger"}`}>
                {test.ok ? (
                  `Test passed, “${test.reply}” from ${test.model} in ${(test.latencyMs / 1000).toFixed(1)}s`
                ) : (
                  <LinkText text={`Test failed, ${test.error}`} />
                )}
              </p>
            )}
            <p className="mt-0.5 text-[12px] text-ink-dim">Connected {timeAgo(c.connectedMs)}</p>
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-edge px-4 py-2.5">
          <span className="text-[12px] text-ink-dim">Usage</span>
          {usage ? (
            <>
              <WindowChip window={usage.primary} label={windowName(usage.primary, "5-hour window")} />
              <WindowChip window={usage.secondary} label={windowName(usage.secondary, "Weekly window")} />
              {usage.credits?.hasCredits && (
                <span className="text-[11.5px] text-ink-dim">
                  Credits{usage.credits.unlimited ? ", unlimited" : usage.credits.balance ? ` ${usage.credits.balance}` : ""}
                </span>
              )}
              <span className="text-[11.5px] text-ink-faint">{timeAgo(usage.fetchedMs)}</span>
            </>
          ) : (
            <span className="text-[12px] text-ink-dim">
              {props.usage.loading ? "Reading from OpenAI…" : (props.usage.error ?? "unavailable right now")}
            </span>
          )}
          <Link to="/app/models" className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
            Models <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </Card>
  );
}

/** "5-hour window · 72% left, resets in 2h 10m" with a small bar. */
export function WindowChip(props: { window: UsageWindow | null; label: string; wide?: boolean }) {
  const w = props.window;
  const tone = quotaTone(w?.remainingPercent ?? null);
  return (
    <span className={`inline-flex ${props.wide ? "w-full" : "min-w-[11rem]"} flex-col gap-1 rounded-md border border-edge px-2 py-1.5 text-[11.5px]`}>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-ink-dim">{props.label}</span>
        <span className={`tnum shrink-0 font-medium ${toneTextClass(tone)}`}>
          {!w || w.remainingPercent === null ? "?" : w.exhausted ? "out" : `${w.remainingPercent}% left`}
          {w?.resetMs ? <span className="ml-1 font-normal text-ink-dim">{countdown(w.resetMs)}</span> : null}
        </span>
      </span>
      <Progress percent={w?.remainingPercent ?? null} tone={tone} className="h-1" />
    </span>
  );
}
