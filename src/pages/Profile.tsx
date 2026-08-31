import { CalendarDays, ChevronRight, KeyRound, LogOut, Palette, Plug, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../App";
import { Avatar, Button, Card, Toggle } from "../components/ui";
import { useTheme } from "../lib/theme";

export default function Profile() {
  const { me, signOut } = useAuth();
  const { theme, setTheme, reducedMotion, setReducedMotion } = useTheme();
  const name = me?.user.displayName || me?.user.email.split("@")[0] || "Ohshi member";
  const email = me?.user.email ?? "";
  const joined = me?.user.createdMs
    ? new Date(me.user.createdMs).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "Recently";

  return (
    <div className="profile-page rise-in mx-auto max-w-5xl space-y-8">
      <header className="settings-header">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={name} size="md" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Settings</p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
            <p className="mt-1 truncate text-sm text-ink-dim">{email}</p>
          </div>
        </div>
        <p className="settings-meta">
          <CalendarDays className="h-3.5 w-3.5" /> Joined {joined}
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
        <Card title="Preferences" aside={<Palette className="h-4 w-4 text-ink-dim" />}>
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold">Appearance</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-dim">Choose the workspace theme you want to use.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["light", "dark"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTheme(option)}
                    aria-pressed={theme === option}
                    className={`settings-theme-choice ${theme === option ? "settings-theme-choice-active" : ""}`}
                  >
                    <span className={`mb-3 block h-7 rounded-lg border ${option === "light" ? "bg-white" : "bg-[#121826]"}`} />
                    <span className="text-xs font-semibold capitalize">{option}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row border-t border-edge pt-5">
              <div>
                <p className="text-sm font-semibold">Reduce motion</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-dim">Remove non-essential movement across the workspace.</p>
              </div>
              <Toggle checked={reducedMotion} onChange={setReducedMotion} label={reducedMotion ? "On" : "Off"} />
            </div>
          </div>
        </Card>

        <Card title="Account" aside={<ShieldCheck className="h-4 w-4 text-ink-dim" />}>
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">Signed in as</p>
              <p className="mt-2 break-all text-sm font-medium">{email}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-dim">Chats, connections and API keys are private to this account.</p>
            </div>
            <div className="border-t border-edge pt-4">
              <Button tone="ghost" className="w-full justify-center" onClick={() => void signOut()}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Workspace</h2>
          <p className="mt-1 text-xs text-ink-dim">The controls you use most often.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ProfileLink to="/app/accounts" icon={Plug} title="Connections" copy="Manage the accounts that power your models." />
          <ProfileLink to="/app/keys" icon={KeyRound} title="API keys" copy="Create and review keys for your external apps." />
        </div>
      </section>
    </div>
  );
}

function ProfileLink(props: { to: string; icon: typeof Plug; title: string; copy: string }) {
  const Icon = props.icon;
  return (
    <Link to={props.to} className="settings-link flex items-center gap-3 rounded-xl px-3.5 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink/[0.05] text-ink-dim">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{props.title}</span>
        <span className="mt-0.5 block text-xs text-ink-dim">{props.copy}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-dim" />
    </Link>
  );
}
