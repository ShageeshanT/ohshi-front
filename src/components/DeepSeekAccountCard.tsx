/** One connected DeepSeek chat account on the Accounts page. */

import { useState } from "react";
import { Plug, Star, Trash2 } from "lucide-react";
import { friendly, post, timeAgo } from "../lib/api";
import { type ConnectionTestResult, type DeepSeekChatConnection } from "../lib/workspace";
import { DeepSeekLogo } from "./logos";
import { Badge, Button, Card, toneTextClass } from "./ui";

export function DeepSeekAccountCard(props: {
  connection: DeepSeekChatConnection;
  canMakeDefault: boolean;
  onDisconnect: () => void;
  onMakeDefault: () => void;
  onReconnect: () => void;
  onTested: () => void;
}) {
  const c = props.connection;
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<ConnectionTestResult | null>(null);
  const connected = c.status === "active";
  const health = c.health;

  const runTest = () => {
    setTesting(true);
    setTest(null);
    post<ConnectionTestResult>(`/api/deepseek/connections/${c.id}/test`)
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
            <DeepSeekLogo className="h-4 w-4" />
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
                health?.status === "error" ? (
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
              <Badge>DeepSeek chat</Badge>
            </div>
            <p className="mt-1 text-[12px] text-ink-dim">
              {connected
                ? `Connected ${timeAgo(c.connectedMs)}`
                : "Sign in again — DeepSeek no longer accepts this session."}
              {health?.lastError ? ` · ${health.lastError}` : ""}
            </p>
            {test && (
              <p className={`mt-1 text-[12px] ${test.ok ? toneTextClass("ok") : toneTextClass("danger")}`}>
                {test.ok
                  ? `Answered in ${test.latencyMs} ms (${test.model || "DeepSeek"})`
                  : test.error || "Test failed"}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {connected && (
            <Button size="sm" tone="ghost" busy={testing} onClick={runTest}>
              Test
            </Button>
          )}
          {props.canMakeDefault && connected && (
            <Button size="sm" tone="ghost" onClick={props.onMakeDefault}>
              <Star className="h-3.5 w-3.5" /> Default
            </Button>
          )}
          {!connected && (
            <Button size="sm" onClick={props.onReconnect}>
              <Plug className="h-3.5 w-3.5" /> Reconnect
            </Button>
          )}
          <Button size="sm" tone="ghost" onClick={props.onDisconnect}>
            <Trash2 className="h-3.5 w-3.5" /> Disconnect
          </Button>
        </div>
      </div>
    </Card>
  );
}
