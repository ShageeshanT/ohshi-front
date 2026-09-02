/**
 * Connections — every AI subscription Ohshi will speak to, one card each.
 * Google is live (a Gemini API key, or the account behind a Google AI plan);
 * ChatGPT, Claude and SuperGrok are being built and stay locked until they
 * ship. Nothing here pretends to work before it does.
 */

import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { ClaudeLogo, GoogleLogo, OpenAILogo, XaiLogo } from "../components/logos";
import { Badge, Button, PageHeader } from "../components/ui";
import { useConnections, useGeminiKeys } from "../lib/workspace";

interface Provider {
  id: string;
  name: string;
  Logo: ComponentType<{ className?: string }>;
  access: string;
  models: string;
  live: boolean;
  note?: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "google",
    name: "Google",
    Logo: GoogleLogo,
    access: "Gemini API key from AI Studio, or the account behind Google AI Pro and Ultra (Beta)",
    models: "Gemini 2.5 and 3 on the key. Gemini, Claude and GPT-OSS through the account, with live quota.",
    live: true,
  },
  {
    id: "openai",
    name: "ChatGPT",
    Logo: OpenAILogo,
    access: "ChatGPT Plus and Pro",
    models: "The GPT models on the plan, in chat and behind the same ohs_ key.",
    live: false,
    note: "Being built",
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

export default function Connections() {
  const { connections } = useConnections();
  const { gemini } = useGeminiKeys();
  const keys = (gemini?.keys ?? []).filter((k) => k.status === "active").length;
  const accounts = (connections ?? []).filter((c) => c.status === "active").length;
  const known = connections !== null && gemini !== null;

  return (
    <div className="rise-in space-y-6">
      <PageHeader
        title="Connections"
        description="Every AI subscription you connect shows up in the same picker and behind the same ohs_ key. Google is live; the others are locked until they ship."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            detail={
              p.live
                ? !known
                  ? "Checking…"
                  : keys + accounts === 0
                    ? "Nothing connected yet"
                    : `${keys} Gemini key${keys === 1 ? "" : "s"}, ${accounts} Google account${accounts === 1 ? "" : "s"}`
                : undefined
            }
          />
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
            <Link to="/app/accounts">
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
