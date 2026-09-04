/**
 * Admin — who is using Ohshi, how much, on what plan, with what connected,
 * and who has been banned. Reachable only by the emails the backend lists
 * in OHSHI_ADMIN_EMAILS; the API answers 403 to anyone else and the route
 * guard in App.tsx sends them back to the chat.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw, ShieldBan, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Notice, PageHeader, Progress, SectionTitle, Spinner, Stat, Tabs } from "../components/ui";
import { formatNumber, friendly, timeAgo } from "../lib/api";
import { fetchOverview, fetchUsers, type AdminOverview, type AdminUserList, type AdminUserRow, type UserSort, type UserStatusFilter } from "../lib/admin";

const STATUS_TABS: { label: string; value: UserStatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Paid", value: "paid" },
  { label: "Flagged", value: "flagged" },
  { label: "Banned", value: "banned" },
];

const SORTS: { label: string; value: UserSort }[] = [
  { label: "Newest", value: "created" },
  { label: "Most requests (30d)", value: "requests" },
  { label: "Last seen", value: "lastSeen" },
  { label: "Email", value: "email" },
];

export function planTone(plan: string): "dim" | "accent" | "violet" {
  return plan === "pro" ? "violet" : plan === "plus" ? "accent" : "dim";
}

export function StateBadges(props: { row: Pick<AdminUserRow, "isActive" | "billingFlag" | "isAdmin" | "subscriptionStatus"> }) {
  const r = props.row;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {!r.isActive && <Badge tone="danger">Banned</Badge>}
      {r.billingFlag && <Badge tone="warn">{r.billingFlag}</Badge>}
      {r.subscriptionStatus === "cancelled" && <Badge tone="warn">Cancelling</Badge>}
      {r.subscriptionStatus === "payment_failed" && <Badge tone="warn">Payment failed</Badge>}
      {r.isAdmin && <Badge tone="accent">Admin</Badge>}
      {r.isActive && !r.billingFlag && !r.isAdmin && r.subscriptionStatus !== "cancelled" && <Badge tone="ok" dot>Active</Badge>}
    </span>
  );
}

function connectedSummary(c: AdminUserRow["connections"]): string {
  const parts: string[] = [];
  if (c.google) parts.push(`${c.google} Google`);
  if (c.chatgpt) parts.push(`${c.chatgpt} ChatGPT`);
  if (c.deepseek) parts.push(`${c.deepseek} DeepSeek`);
  if (c.geminiKeys) parts.push(`${c.geminiKeys} Gemini key${c.geminiKeys === 1 ? "" : "s"}`);
  if (c.deepseekKeys) parts.push(`${c.deepseekKeys} DeepSeek key${c.deepseekKeys === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "nothing";
}

export default function Admin() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [list, setList] = useState<AdminUserList | null>(null);
  const [q, setQ] = useState("");
  const [needle, setNeedle] = useState("");
  const [status, setStatus] = useState<UserStatusFilter>("all");
  const [sort, setSort] = useState<UserSort>("created");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pageSize = 50;

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await fetchOverview());
    } catch (err) {
      setError(friendly(err));
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // Type-ahead search without a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setNeedle(q.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    fetchUsers({ q: needle, status, sort, page, pageSize })
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((err) => {
        if (!cancelled) setError(friendly(err));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needle, status, sort, page]);

  const o = overview;
  const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="rise-in space-y-7">
      <PageHeader
        title="Admin"
        description="Every account, what it uses, what it pays for, and what it has connected. Chat content is never shown here, only counts."
        actions={
          <Button tone="ghost" onClick={() => void loadOverview()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {error && (
        <Notice tone="danger" onClose={() => setError(null)}>
          {error}
        </Notice>
      )}

      {o ? (
        <div className="tiles grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Accounts" value={formatNumber(o.users.total)} sub={`${o.users.new7d} new this week`} />
          <Stat label="Active, 7 days" value={formatNumber(o.users.active7d)} sub="signed in or called a model" />
          <Stat
            label="Paying"
            value={formatNumber(o.users.paid)}
            sub={`${o.users.byPlan.plus ?? 0} Plus, ${o.users.byPlan.pro ?? 0} Pro`}
            tone={o.users.paid ? "ok" : undefined}
          />
          <Stat label="Requests, 7 days" value={formatNumber(o.requests.d7)} sub={`${formatNumber(o.requests.today)} today`} />
          <Stat
            label="Errors, 7 days"
            value={formatNumber(o.requests.errors7d)}
            sub={o.requests.d7 ? `${Math.round((o.requests.errors7d / o.requests.d7) * 100)}% of calls` : "no calls yet"}
            tone={o.requests.errors7d ? "warn" : undefined}
          />
          <Stat
            label="Banned"
            value={formatNumber(o.users.banned)}
            sub={`${o.users.flagged} flagged by billing`}
            tone={o.users.banned ? "danger" : undefined}
            icon={ShieldBan}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px] text-ink-dim">
          <Spinner size={14} /> Loading the overview
        </div>
      )}

      {o && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Heaviest accounts, 7 days" description="Who is sending the most through the gateway. The place to look for abuse." flush>
            {o.topUsers.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No calls in the last 7 days" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Plan</th>
                      <th className="num">Calls</th>
                      <th className="num">Errors</th>
                      <th className="num">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.topUsers.map((u) => (
                      <tr key={u.id} className="cursor-pointer hover:bg-ink/[0.03]" onClick={() => navigate(`/app/admin/u/${u.id}`)}>
                        <td>
                          <span className={`block max-w-[13rem] truncate ${u.isActive ? "" : "text-danger line-through"}`} title={u.email}>
                            {u.email}
                          </span>
                        </td>
                        <td>
                          <Badge tone={planTone(u.plan)}>{u.plan}</Badge>
                        </td>
                        <td className="num font-medium">{formatNumber(u.requests7d)}</td>
                        <td className={`num ${u.errors7d ? "font-medium text-danger" : "text-ink-dim"}`}>{u.errors7d}</td>
                        <td className="num text-ink-dim">{formatNumber(u.tokens7d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Models, 7 days" description="What the gateway actually served." flush>
            {o.topModels.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Nothing served yet" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th className="num">Calls</th>
                      <th className="num">Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.topModels.map((m) => (
                      <tr key={m.model}>
                        <td className="mono max-w-[16rem] truncate text-[12px]" title={m.model}>
                          {m.model}
                        </td>
                        <td className="num">{formatNumber(m.requests)}</td>
                        <td className="num text-ink-dim">{formatNumber(m.tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      <section className="space-y-3">
        <SectionTitle
          title="Accounts"
          description="Search by email or name. Click a row for the full picture and the ban switch."
          aside={
            <span className="text-[12px] text-ink-dim">
              {list ? `${formatNumber(list.total)} account${list.total === 1 ? "" : "s"}` : ""}
            </span>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-72">
            <Input value={q} onChange={setQ} placeholder="Search email or name" />
          </div>
          <Tabs
            tabs={STATUS_TABS.map((t) => t.label)}
            active={STATUS_TABS.find((t) => t.value === status)?.label ?? "All"}
            onChange={(label) => {
              setStatus(STATUS_TABS.find((t) => t.label === label)?.value ?? "all");
              setPage(1);
            }}
          />
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as UserSort);
              setPage(1);
            }}
            aria-label="Sort"
            className="h-9 rounded-lg border border-edge bg-panel px-2.5 text-[13px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {busy && <Spinner size={14} />}
        </div>

        <Card flush>
          {list && list.users.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No accounts match" hint="Try a different search or filter." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Plan</th>
                    <th>This month</th>
                    <th className="num">30 days</th>
                    <th>Connected</th>
                    <th className="num">Keys</th>
                    <th>Last seen</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {(list?.users ?? []).map((u) => {
                    const pct = u.requestLimit ? Math.min(100, Math.round((u.requestsMonth / u.requestLimit) * 100)) : 0;
                    return (
                      <tr key={u.id} className="cursor-pointer hover:bg-ink/[0.03]" onClick={() => navigate(`/app/admin/u/${u.id}`)}>
                        <td className="max-w-[18rem]">
                          <Link to={`/app/admin/u/${u.id}`} className="block truncate font-medium text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                            {u.email}
                          </Link>
                          <span className="block truncate text-[11.5px] text-ink-dim">
                            {u.displayName || "no name"} · {u.authProvider === "clerk" ? "Clerk" : "password"} · joined {timeAgo(u.createdMs)}
                          </span>
                        </td>
                        <td>
                          <Badge tone={planTone(u.plan)}>{u.planLabel}</Badge>
                          {u.planRenewsMs && u.plan !== "free" && (
                            <span className="block text-[11px] text-ink-dim">
                              {u.subscriptionStatus === "cancelled" ? "ends" : "renews"} {timeAgo(u.planRenewsMs)}
                            </span>
                          )}
                        </td>
                        <td className="min-w-[9rem]">
                          <span className="tnum text-[12px]">
                            {formatNumber(u.requestsMonth)} <span className="text-ink-dim">/ {formatNumber(u.requestLimit)}</span>
                          </span>
                          <Progress percent={pct} tone={pct >= 100 ? "danger" : pct >= 80 ? "warn" : "accent"} className="mt-1" />
                        </td>
                        <td className="num whitespace-nowrap">
                          {formatNumber(u.requests30d)}
                          {u.errors30d ? <span className="ml-1 text-[11px] text-danger">{u.errors30d} err</span> : null}
                        </td>
                        <td className="max-w-[14rem] truncate text-[12px] text-ink-dim" title={connectedSummary(u.connections)}>
                          {connectedSummary(u.connections)}
                        </td>
                        <td className="num">{u.apiKeys}</td>
                        <td className="whitespace-nowrap text-[12px] text-ink-dim">{u.lastSeenMs ? timeAgo(u.lastSeenMs) : "never"}</td>
                        <td>
                          <StateBadges row={u} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {list && pages > 1 && (
            <div className="flex items-center justify-between border-t border-edge px-4 py-2.5 text-[12px] text-ink-dim">
              <span>
                Page {list.page} of {pages}
              </span>
              <span className="flex gap-1.5">
                <Button tone="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button tone="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                  Next
                </Button>
              </span>
            </div>
          )}
        </Card>
      </section>

      {o && o.recentSignups.length > 0 && (
        <Card title="Newest sign-ups" description="The last eight accounts created." flush>
          <ul className="divide-y divide-edge">
            {o.recentSignups.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2 text-[12.5px]">
                <Link to={`/app/admin/u/${u.id}`} className="truncate font-medium hover:underline">
                  {u.email}
                </Link>
                <span className="flex shrink-0 items-center gap-2 text-ink-dim">
                  <Badge tone={planTone(u.plan)}>{u.plan}</Badge>
                  {timeAgo(u.createdMs)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="inline-flex items-start gap-2 text-[12px] text-ink-dim">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-ok" />
        Only the addresses in OHSHI_ADMIN_EMAILS can see this page. A ban signs the account out everywhere and locks its API keys and connector at once.
      </p>
    </div>
  );
}
