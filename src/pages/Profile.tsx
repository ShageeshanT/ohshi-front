import { CalendarDays, ChevronRight, KeyRound, LogOut, Palette, Plug, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../App";
import { Avatar, Button, Card, Toggle } from "../components/ui";
import { useTheme } from "../lib/theme";

export default function Profile() {
  const { me, signOut } = useAuth();
  const { theme, setTheme, reducedMotion, setReducedMotion } = useTheme();
  const name = me?.user.displayName || me?.user.email.split("@")[0] || "Ohshi member";
  const email = me?.user.email ?? "";
  const joined = me?.user.createdMs ? new Date(me.user.createdMs).toLocaleDateString(undefined, { month: "long", year: "numeric" }) : "Recently";

  return (
    <div className="rise-in mx-auto max-w-4xl space-y-6">
      <header className="profile-hero overflow-hidden rounded-[2rem] p-5 sm:p-8">
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <Avatar name={name} size="md" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Your workspace</p>
              <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
              <p className="mt-1 truncate text-sm text-ink-dim">{email}</p>
            </div>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-edge bg-panel/70 px-3 py-2 text-xs font-medium text-ink-dim">
            <CalendarDays className="h-3.5 w-3.5 text-accent" /> Member since {joined}
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <Card title="Preferences" aside={<Palette className="h-4 w-4 text-ink-dim" />}>
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold">Appearance</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">Choose the workspace palette that feels best for longer sessions.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["light", "dark"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTheme(option)}
                    aria-pressed={theme === option}
                    className={`rounded-2xl border p-3 text-left transition-all ${
                      theme === option
                        ? "border-accent bg-accent-soft text-ink shadow-sm"
                        : "border-edge bg-panel-2/60 text-ink-dim hover:border-ink/20 hover:text-ink"
                    }`}
                  >
                    <span className={`mb-2 block h-8 rounded-xl border ${option === "light" ? "bg-white" : "bg-[#101827]"}`} />
                    <span className="text-xs font-bold capitalize">{option}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-5">
              <div>
                <p className="text-sm font-semibold">Reduce interface motion</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-dim">Keep the layout calm by removing movement and long transitions.</p>
              </div>
              <Toggle checked={reducedMotion} onChange={setReducedMotion} label={reducedMotion ? "On" : "Off"} />
            </div>
          </div>
        </Card>

        <Card title="Account" aside={<ShieldCheck className="h-4 w-4 text-ink-dim" />}>
          <div className="space-y-4">
            <div className="rounded-2xl bg-ink/[0.035] p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-dim">Signed in as</p>
              <p className="mt-1 break-all text-sm font-semibold">{email}</p>
              <p className="mt-1 text-xs text-ink-dim">Your chats, connections and keys are scoped to this account.</p>
            </div>
            <Button tone="ghost" className="w-full" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-base font-bold tracking-tight">Workspace shortcuts</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ProfileLink to="/app/accounts" icon={Plug} title="Connections" copy="Add, test and manage the Google accounts that power your models." />
          <ProfileLink to="/app/keys" icon={KeyRound} title="API keys" copy="Create an agent key or review the keys already in your workspace." />
        </div>
      </section>
    </div>
  );
}

function ProfileLink(props: { to: string; icon: typeof Plug; title: string; copy: string }) {
  const Icon = props.icon;
  return (
    <Link to={props.to} className="glass lift flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{props.title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-dim">{props.copy}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-dim" />
    </Link>
  );
}
