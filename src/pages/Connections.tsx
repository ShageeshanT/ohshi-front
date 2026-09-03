/**
 * Connections — every AI provider Ohshi will speak to, one card each.
 * Google is live (a Gemini API key, or the account behind a Google AI plan),
 * so is DeepSeek (an API key; DeepSeek sells no subscription) and so is
 * ChatGPT (the account behind a Plus, Pro or Team plan). Claude and SuperGrok
 * are being built and stay locked until they ship. Nothing here pretends to
 * work before it does.
 */

import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { ClaudeLogo, DeepSeekLogo, GoogleLogo, OpenAILogo, XaiLogo } from "../components/logos";
import { Badge, Button, PageHeader } from "../components/ui";
import { useChatGPTConnections, useConnections, useDeepSeekChat, useDeepSeekKeys, useGeminiKeys } from "../lib/workspace";

interface Provider {
  id: string;
  name: string;
  Logo: ComponentType<{ className?: string }>;
  access: string;
  models: string;
  live: boolean;
  note?: string;
  /** Where "Manage" goes. */
  to?: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "google",
    name: "Google",
    Logo: GoogleLogo,
    access: "Gemini API key from AI Studio, or the account behind Google AI Pro and Ultra (Beta)",
    models: "Gemini 2.5 and 3 on the key. Gemini, Claude and GPT-OSS through the account, with live quota.",
    live: true,
    to: "/app/accounts",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    Logo: DeepSeekLogo,
    access: "DeepSeek API key from platform.deepseek.com, or the free chat account at chat.deepseek.com (Beta)",
    models: "DeepSeek V4 Flash and V4 Pro with thinking, plus the vision preview. Pay as you go on a key, or run on the consumer chat account.",
    live: true,
    to: "/app/accounts#deepseek",
  },
  {
    id: "openai",
    name: "ChatGPT",
    Logo: OpenAILogo,
    access: "ChatGPT Plus, Pro and Team, signed in the way the Codex CLI does (Beta)",
    models: "The GPT and Codex models on the plan, with the plan's rolling usage windows, in chat and behind the same ohs_ key.",
    live: true,
    to: "/app/accounts#chatgpt",
  },
  {
    id: "anthropic",
    name: "Claude",
    Logo: ClaudeLogo,
    access: "Claude Pro and Max",
    models: "Claude Sonnet and Opus with thinking.",
    live: false,
    note: "Being built",
  },
  {
    id: "xai",
    name: "SuperGrok",
    Logo: XaiLogo,
    access: "SuperGrok and SuperGrok Heavy",
    models: "The Grok models on the plan.",
    live: false,
    note: "Planned",
  },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function Connections() {
  const { connections } = useConnections();
  const { gemini } = useGeminiKeys();
  const { deepseek } = useDeepSeekKeys();
  const { chatgpt } = useChatGPTConnections();
  const { deepseekChat } = useDeepSeekChat();
  const keys = (gemini?.keys ?? []).filter((k) => k.status === "active").length;
  const deepseekKeys = (deepseek?.keys ?? []).filter((k) => k.status === "active").length;
  const deepseekAccounts = (deepseekChat?.connections ?? []).filter((c) => c.status === "active").length;
  const accounts = (connections ?? []).filter((c) => c.status === "active").length;
  const chatgptAccounts = (chatgpt?.connections ?? []).filter((c) => c.status === "active").length;
  const googleKnown = connections !== null && gemini !== null;
  const deepseekKnown = deepseek !== null && deepseekChat !== null;
  const chatgptKnown = chatgpt !== null;

  const detailFor = (id: string): string | undefined => {
    if (id === "google") {
      if (!googleKnown) return "Checking…";
      if (keys + accounts === 0) return "Nothing connected yet";
      return `${plural(keys, "Gemini key")}, ${plural(accounts, "Google account")}`;
    }
    if (id === "deepseek") {
      if (!deepseekKnown) return "Checking…";
      if (deepseekKeys + deepseekAccounts === 0) return "Nothing connected yet";
      return `${plural(deepseekKeys, "DeepSeek key")}, ${plural(deepseekAccounts, "DeepSeek account")}`;
    }
    if (id === "openai") {
      if (!chatgptKnown) return "Checking…";
      if (chatgptAccounts === 0) return "Nothing connected yet";
      return plural(chatgptAccounts, "ChatGPT account");
    }
    return undefined;
  };

  return (
    <div className="rise-in space-y-6">
      <PageHeader
        title="Connections"
        description="Every AI provider you connect shows up in the same picker and behind the same ohs_ key. Google, DeepSeek and ChatGPT are live; the others are locked until they ship."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {PROVIDERS.map((p) => (
          <ProviderCard key={p.id} provider={p} detail={p.live ? detailFor(p.id) : undefined} />
        ))}
      </div>

      <p className="text-[12.5px] text-ink-dim">
        Locked providers open the moment their connection is finished and tested. What you connect stays yours: Ohshi
        never resells model access.
      </p>
    </div>
  );
}

function ProviderCard(props: { provider: Provider; detail?: string }) {
  const { provider: p } = props;
  return (
    <div className={`card relative flex flex-col p-5 ${p.live ? "" : "provider-locked"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-edge bg-panel ${p.live ? "text-ink" : "text-ink-faint"}`}>
          <p.Logo className="h-5 w-5" />
        </span>
        {p.live ? (
          <Badge tone="ok" dot>
            Live
          </Badge>
        ) : (
          <Badge>
            <Lock className="h-3 w-3" /> {p.note ?? "Locked"}
          </Badge>
        )}
      </div>
      <h2 className={`mt-4 text-[15px] font-semibold tracking-tight ${p.live ? "" : "text-ink-dim"}`}>{p.name}</h2>
      <p className="mt-1 text-[12px] font-medium text-ink-dim">{p.access}</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-dim">{p.models}</p>
      <div className="mt-5 flex flex-1 items-end justify-between gap-3">
        {p.live ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-dim">
              <Sparkles className="h-3.5 w-3.5 text-ok" /> {props.detail}
            </span>
            <Link to={p.to ?? "/app/accounts"}>
              <Button size="sm">
                Manage <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint">
              <Lock className="h-3.5 w-3.5" /> Under development
            </span>
            <Button size="sm" tone="ghost" disabled>
              Coming soon
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
