/**
 * Account — who you are, how the workspace looks, the password, what is
 * attached to the account, and the way out. Display name saves through
 * POST /api/auth/profile on password accounts; on Clerk it comes from the
 * sign-in provider.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check, ChevronRight, CreditCard, KeyRound, Layers, LogOut, Plug } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth, type Me } from "../App";
import { ChangePassword } from "../components/ChangePassword";
import { Avatar, Badge, Button, Card, Input, Toggle } from "../components/ui";
import { friendly, get, post } from "../lib/api";
import { useTheme, type Theme } from "../lib/theme";

interface Counts {
  apiKeys: number | null;
  geminiKeys: number | null;
  accounts: number | null;
}

export default function Profile() {
  const { me, setMe, signOut } = useAuth();
  const { theme, setTheme, reducedMotion, setReducedMotion } = useTheme();
  const clerk = me?.config.authProvider === "clerk";
  const email = me?.user.email ?? "";
  const displayName = me?.user.displayName || email.split("@")[0] || "Ohshi member";
  const joined = me?.user.createdMs
    ? new Date(me.user.createdMs).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "recently";
  const plan = me?.user.plan ?? "free";

  const [name, setName] = useState(me?.user.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>({ apiKeys: null, geminiKeys: null, accounts: null });

  useEffect(() => {
    let cancelled = false;
    const set = (patch: Partial<Counts>) => {
      if (!cancelled) setCounts((c) => ({ ...c, ...patch }));
    };
    get<{ keys: { revokedMs: number | null }[] }>("/api/keys")
      .then((d) => set({ apiKeys: d.keys.filter((k) => k.revokedMs === null).length }))
      .catch(() => set({ apiKeys: 0 }));
    get<{ keys: { status: string }[] }>("/api/gemini/keys")
      .then((d) => set({ geminiKeys: d.keys.filter((k) => k.status === "active").length }))
      .catch(() => set({ geminiKeys: 0 }));
    get<{ connections: { status: string }[] }>("/api/google/connections")
      .then((d) => set({ accounts: d.connections.filter((c) => c.status === "active").length }))
      .catch(() => set({ accounts: 0 }));
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = name.trim() !== (me?.user.displayName ?? "");

  const save = () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    post<Me>("/api/auth/profile", { displayName: name.trim() })
      .then((next) => {
        setMe(next);
        setName(next.user.displayName);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1800);
      })
      .catch((e) => setError(friendly(e)))
      .finally(() => setSaving(false));
  };

  const plural = (n: number | null, word: string) => (n === null ? "…" : `${n} ${word}${n === 1 ? "" : "s"}`);

  return (
    <div className="rise-in mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-semibold tracking-tight">{displayName}</h1>
            <p className="truncate text-[13px] text-ink-dim">{email}</p>
            <p className="mt-0.5 text-[12px] text-ink-faint">Member since {joined}</p>
          </div>
        </div>
        <Button tone="ghost" onClick={() => void signOut()}>
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </Button>
      </header>

      <Card title="Profile" description="How you appear in the sidebar and the account menu.">
        <div className="divide-y divide-edge">
          <Row
            label="Display name"
            hint={clerk ? "Comes from the account you sign in with." : "Leave it blank to use the first part of your email."}
          >
            {clerk ? (
              <span className="text-[13px]">{me?.user.displayName || "—"}</span>
            ) : (
              <form
                className="flex w-full max-w-sm items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save();
                }}
              >
                <Input value={name} onChange={setName} placeholder="Your name" maxLength={120} />
                <Button type="submit" tone={dirty ? "primary" : "ghost"} busy={saving} disabled={!dirty}>
                  {saved ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Saved
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </form>
            )}
            {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
          </Row>
          <Row label="Email" hint={clerk ? "Managed by your sign-in provider." : "The address you sign in with."}>
            <span className="break-all text-[13px]">{email}</span>
          </Row>
          <Row label="Sign-in method">
            <Badge>{clerk ? "Clerk account" : "Email and password"}</Badge>
          </Row>
        </div>
      </Card>

      <Card title="Security" description="Your password, and the browsers signed in with it.">
        <div className="divide-y divide-edge">
          <Row
            label="Password"
            hint={
              clerk
                ? "We email you a one-time code first, then you choose the new password."
                : "Prove the current password, then choose a new one."
            }
          >
            <ChangePassword />
          </Row>
          <Row label="Sessions" hint="Changing the password signs every other browser out. This one stays.">
            <Button tone="ghost" onClick={() => void signOut()}>
              <LogOut className="h-3.5 w-3.5" /> Sign out of this browser
            </Button>
          </Row>
        </div>
      </Card>

      <Card title="Appearance" description="Saved in this browser only.">
        <div className="divide-y divide-edge">
          <Row label="Theme" hint="Light is the default. Your pick sticks on this device.">
            <div className="grid w-full max-w-xs grid-cols-2 gap-2">
              <ThemeChoice value="light" active={theme === "light"} onPick={setTheme} />
              <ThemeChoice value="dark" active={theme === "dark"} onPick={setTheme} />
            </div>
          </Row>
          <Row label="Reduce motion" hint="Turn off the non-essential animation across the workspace.">
            <Toggle checked={reducedMotion} onChange={setReducedMotion} label={reducedMotion ? "On" : "Off"} />
          </Row>
        </div>
      </Card>

      <Card title="Workspace" description="Everything attached to this account." flush>
        <div className="divide-y divide-edge">
          <LinkRow
            to="/app/billing"
            icon={CreditCard}
            title="Plan and billing"
            sub={`${plan[0].toUpperCase()}${plan.slice(1)} plan`}
          />
          <LinkRow
            to="/app/accounts"
            icon={Plug}
            title="Google access"
            sub={`${plural(counts.geminiKeys, "Gemini key")}, ${plural(counts.accounts, "Google account")}`}
          />
          <LinkRow to="/app/models" icon={Layers} title="Models" sub="Quota per model and what each key can call" />
          <LinkRow to="/app/keys" icon={KeyRound} title="API keys" sub={`${plural(counts.apiKeys, "active key")}`} />
          <LinkRow to="/app/docs" icon={BookOpen} title="Docs" sub="A request snippet for every model on your route" />
        </div>
      </Card>

      <Card title="Privacy" description="What Ohshi keeps about you.">
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-dim">
          <li>Chats are saved so you can search them. Delete any of them from the sidebar.</li>
          <li>Prompts sent to /v1 are never stored, only usage metadata: model, tokens, latency, outcome.</li>
          <li>Gemini keys and Google tokens are encrypted at rest. Passwords are hashed with Argon2id, ohs_ keys are stored hashed.</li>
        </ul>
        <p className="mt-3 text-[12.5px] text-ink-dim">
          <Link to="/privacy" className="font-medium text-ink hover:underline">
            Privacy policy
          </Link>
          <span className="mx-1.5 text-ink-faint">·</span>
          <Link to="/terms" className="font-medium text-ink hover:underline">
            Terms and conditions
          </Link>
        </p>
      </Card>
    </div>
  );
}

function Row(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[200px_1fr] sm:items-start sm:gap-6">
      <div className="sm:pt-1">
        <p className="text-[13px] font-medium">{props.label}</p>
        {props.hint && <p className="mt-0.5 text-[12px] leading-snug text-ink-dim">{props.hint}</p>}
      </div>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

/** A two-tone thumbnail of the workspace in each theme. */
function ThemeChoice(props: { value: Theme; active: boolean; onPick: (theme: Theme) => void }) {
  const dark = props.value === "dark";
  const bg = dark ? "#121317" : "#ffffff";
  const rail = dark ? "#0c0d10" : "#fafafa";
  const line = dark ? "#26272e" : "#e4e4e7";
  const text = dark ? "#8e919b" : "#a1a1aa";
  return (
    <button
      type="button"
      onClick={() => props.onPick(props.value)}
      aria-pressed={props.active}
      className={`rounded-lg border p-1.5 text-left transition-colors ${
        props.active ? "border-ink ring-1 ring-ink" : "border-edge hover:border-edge-strong"
      }`}
    >
      <span className="relative block h-16 overflow-hidden rounded-md border" style={{ background: bg, borderColor: line }}>
        <span className="absolute inset-y-0 left-0 w-[30%] border-r" style={{ background: rail, borderColor: line }}>
          <span className="mx-1.5 mt-2 block h-1 w-1/2 rounded" style={{ background: text }} />
          <span className="mx-1.5 mt-1.5 block h-1 w-2/3 rounded" style={{ background: line }} />
          <span className="mx-1.5 mt-1 block h-1 w-1/2 rounded" style={{ background: line }} />
        </span>
        <span className="absolute left-[30%] right-0 top-0 h-3 border-b" style={{ borderColor: line }} />
        <span className="absolute left-[38%] top-5 h-1 w-1/3 rounded" style={{ background: text }} />
        <span className="absolute left-[38%] right-3 top-8 h-5 rounded border" style={{ borderColor: line }} />
      </span>
      <span className="mt-1.5 flex items-center justify-between px-0.5 text-[12px] font-medium capitalize">
        {props.value}
        {props.active && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

function LinkRow(props: { to: string; icon: LucideIcon; title: string; sub: string }) {
  const Icon = props.icon;
  return (
    <Link to={props.to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink/[0.03]">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-panel text-ink-dim">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{props.title}</span>
        <span className="block truncate text-[12px] text-ink-dim">{props.sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
    </Link>
  );
}
