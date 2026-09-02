/**
 * Usage — everything that went through the gateway in the last 30 days:
 * totals, the split by model, the recent calls, and (on a backend with
 * billing) how much of the month's plan allowance is used.
 */

import { Link } from "react-router-dom";
import { ArrowRight, CreditCard } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader, Progress, SectionTitle, Spinner, Stat } from "../components/ui";
import { formatNumber, timeAgo } from "../lib/api";
import { useUsage } from "../lib/workspace";

export default function Usage() {
  const { usage } = useUsage(30);
  const u = usage;
  const plan = u?.entitlement;
  const errorRate = u && u.totals.requests ? Math.round((u.totals.errors / u.totals.requests) * 100) : 0;

  return (
    <div className="rise-in space-y-7">
      <PageHeader
        title="Usage"
        description={`What your chat and your agents used through the gateway in the last ${u?.windowDays ?? 30} days. Prompts are never stored, only these numbers.`}
      />

      {plan && plan.requestLimit > 0 && (
        <Card
          title={`${plan.label} plan`}
          description={`Ohshi's own allowance for this ${plan.period || "month"}. The models still run on your key or account.`}
          aside={
            <Link to="/app/billing">
              <Button size="sm" tone="ghost">
                <CreditCard className="h-3.5 w-3.5" /> Plan and billing
              </Button>
            </Link>
          }
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="tnum text-[20px] font-semibold leading-none tracking-tight">
              {formatNumber(plan.requestsUsed)} <span className="text-[13px] font-normal text-ink-dim">of {formatNumber(plan.requestLimit)} requests</span>
            </p>
            <div className="min-w-[12rem] flex-1">
              <Progress
                percent={Math.min(100, Math.round((plan.requestsUsed / plan.requestLimit) * 100))}
                tone={plan.requestsRemaining === 0 ? "danger" : plan.requestsUsed / plan.requestLimit >= 0.8 ? "warn" : "accent"}
              />
            </div>
            <span className="text-[12.5px] text-ink-dim">
              {plan.requestsRemaining === 0 ? "Paused until the month resets" : `${formatNumber(plan.requestsRemaining)} left`}
            </span>
          </div>
        </Card>
      )}

      {!u ? (
        <Card>
          <Spinner label="Loading usage…" />
        </Card>
      ) : (
        <>
          <div className="tiles grid-cols-2 md:grid-cols-4">
            <Stat label="Requests" value={formatNumber(u.totals.requests)} sub={`Last ${u.windowDays} days`} />
            <Stat
              label="Tokens"
              value={formatNumber(u.totals.totalTokens)}
              sub={`${formatNumber(u.totals.promptTokens)} in, ${formatNumber(u.totals.completionTokens)} out`}
            />
            <Stat
              label="Errors"
              value={formatNumber(u.totals.errors)}
              sub={u.totals.requests ? `${errorRate}% of requests` : "No requests yet"}
              tone={u.totals.errors ? "danger" : undefined}
            />
            <Stat label="Models used" value={u.byModel.length} sub={u.byModel[0] ? `Most: ${u.byModel[0].model}` : "—"} />
          </div>

          {u.totals.requests === 0 ? (
            <Card>
              <EmptyState
                title="No calls yet"
                hint="Start a chat, or create an API key and point your agent at /v1. Requests show up here as they happen."
                action={
                  <Link to="/app">
                    <Button tone="ghost">Open chat</Button>
                  </Link>
                }
              />
            </Card>
          ) : (
            <>
              <section className="space-y-3">
                <SectionTitle
                  title="By model"
                  aside={
                    <Link to="/app/models" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-dim hover:text-ink">
                      Quota per model <ArrowRight className="h-3 w-3" />
                    </Link>
                  }
                />
                <Card flush>
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th className="num">Calls</th>
                          <th className="num">Tokens</th>
                          <th className="num">Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {u.byModel.map((row) => (
                          <tr key={row.model}>
                            <td className="mono text-[12px]">{row.model}</td>
                            <td className="num">{formatNumber(row.requests)}</td>
                            <td className="num">{formatNumber(row.totalTokens)}</td>
                            <td className={`num ${row.errors ? "font-medium text-danger" : "text-ink-dim"}`}>{row.errors}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </section>

              <section className="space-y-3">
                <SectionTitle title="Recent calls" description="The newest first. Failures show the status Google or the gateway answered with." />
                <Card flush>
                  <div className="overflow-x-auto">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th>When</th>
                          <th>Endpoint</th>
                          <th className="num">Latency</th>
                          <th className="num">Tokens</th>
                          <th className="num">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {u.recent.slice(0, 25).map((r) => (
                          <tr key={r.id}>
                            <td className="mono max-w-[14rem] truncate text-[12px]" title={r.apiModel}>
                              {r.apiModel}
                            </td>
                            <td className="whitespace-nowrap text-ink-dim">
                              {timeAgo(r.createdMs)}
                              {r.streamed ? ", streamed" : ""}
                            </td>
                            <td className="max-w-[12rem] truncate text-[12px] text-ink-dim" title={r.endpoint}>
                              {r.endpoint || "—"}
                            </td>
                            <td className="num text-ink-dim">{(r.latencyMs / 1000).toFixed(1)}s</td>
                            <td className="num">{r.status === "ok" ? formatNumber(r.totalTokens) : "—"}</td>
                            <td className="num">
                              {r.status === "ok" ? (
                                <Badge tone="ok">ok</Badge>
                              ) : (
                                <Badge tone="danger" className="max-w-[12rem]">
                                  <span className="truncate" title={r.error ?? undefined}>
                                    {r.httpStatus ?? "error"}
                                    {r.error ? ` · ${r.error}` : ""}
                                  </span>
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
