/**
 * Landing-page copy. Written against the register of real LLM product sites
 * (OpenRouter, T3 Chat, Poe, ChatGPT, Claude, Perplexity, Grok, Le Chat):
 * short declarative sentences, second person, concrete nouns, no hype.
 *
 * House style: headings and labels are Title Case; body copy is sentence case.
 * No hyphenated compounds and no typographic symbols in prose — arrows, dots
 * and separators are drawn as vector icons by the components instead. Model
 * ids and product names (GPT-OSS, reasoning_effort) keep their real spelling.
 *
 * Every claim here is true of the product. Keep it that way when editing: a
 * provider is `live` only once its connection has shipped; until then the
 * page says it is next, never that it works.
 */

export type ProviderId = "google" | "openai" | "anthropic" | "xai";

export interface Provider {
  id: ProviderId;
  vendor: string;
  /** The consumer plans the provider sells, named as on its pricing page. */
  plans: string[];
  /** What connecting one of those plans puts in the picker. */
  models: string;
  /** The connection has shipped. Flip this when a provider goes live. */
  live: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    id: "google",
    vendor: "Google",
    plans: ["Google AI Pro", "Google AI Ultra"],
    models: "Gemini 3.6 Flash, Gemini 3.1 Pro, Claude and GPT-OSS through the plan",
    live: true,
  },
  {
    id: "openai",
    vendor: "OpenAI",
    plans: ["ChatGPT Plus", "ChatGPT Pro"],
    models: "The GPT models on the plan",
    live: false,
  },
  {
    id: "anthropic",
    vendor: "Anthropic",
    plans: ["Claude Pro", "Claude Max"],
    models: "Claude Sonnet and Opus with thinking",
    live: false,
  },
  {
    id: "xai",
    vendor: "xAI",
    plans: ["SuperGrok", "SuperGrok Heavy"],
    models: "The Grok models on the plan",
    live: false,
  },
];

export interface LandingCopy {
  nav: string[];
  hero: {
    badge: string;
    line1: string;
    line2: string;
    paragraph: string;
    primaryCta: string;
    secondaryCta: string;
    trust: string[];
  };
  why: {
    eyebrow: string;
    title: string;
    intro: string;
    before: {
      title: string;
      note: string;
      rows: { from: string; fromSub: string; to: string; toSub: string }[];
      tally: string[];
    };
    after: {
      title: string;
      note: string;
      source: string;
      sourceSub: string;
      hub: string;
      hubSub: string;
      outputs: { label: string; sub: string }[];
      tally: string[];
    };
    cards: { title: string; text: string }[];
  };
  how: { eyebrow: string; title: string; intro: string; steps: { title: string; text: string }[] };
  providers: {
    eyebrow: string;
    title: string;
    intro: string;
    hub: string;
    hubSub: string;
    outputs: { label: string; sub: string }[];
    liveLabel: string;
    soonLabel: string;
    plansLabel: string;
    modelsLabel: string;
  };
  models: { eyebrow: string; title: string; intro: string };
  quota: { eyebrow: string; title: string; paragraph: string; bullets: string[] };
  developers: {
    eyebrow: string;
    title: string;
    paragraph: string;
    bullets: string[];
    integrations: string[];
  };
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
  cta: { title: string; text: string; primary: string; secondary: string };
  footer: { tagline: string; disclaimer: string };
}

export const COPY: LandingCopy = {
  nav: ["Why Ohshi", "How It Works", "Providers", "Developers", "FAQ"],
  hero: {
    badge: "Free During Beta",
    line1: "One Subscription.",
    line2: "Chat and API.",
    paragraph:
      "Ohshi turns the AI subscriptions you already pay for into a chat workspace and an OpenAI compatible API. Connect an account and every call runs on that plan. No API credits to buy.",
    primaryCta: "Get Started",
    secondaryCta: "See the API",
    trust: ["Bring Your Own Subscription", "Live Quota Per Model", "Tokens Encrypted at Rest"],
  },
  why: {
    eyebrow: "Why Ohshi",
    title: "Stop Paying Twice for the Same Models.",
    intro:
      "A chat subscription covers the app. API credits cover your code. Same models, two bills, two quotas. Ohshi runs both on the subscription you already have.",
    before: {
      title: "Without Ohshi",
      note: "The same models on both sides, paid for twice.",
      rows: [
        { from: "Chat Subscription", fromSub: "Billed monthly", to: "Chat App", toSub: "The provider's own" },
        { from: "API Credits", fromSub: "Billed per token", to: "Your Agents", toSub: "Scripts, tools, apps" },
      ],
      tally: ["2 bills", "2 quotas", "2 keys"],
    },
    after: {
      title: "With Ohshi",
      note: "The subscription carries both. The ohs_ key is the only key you make.",
      source: "Your Subscription",
      sourceSub: "Billed monthly",
      hub: "Ohshi",
      hubSub: "one ohs_ key",
      outputs: [
        { label: "Chat Workspace", sub: "The chat page" },
        { label: "Your Agents", sub: "Through /v1" },
      ],
      tally: ["1 bill", "1 quota", "1 key"],
    },
    cards: [
      {
        title: "Chat Workspace",
        text: "Streaming replies, Markdown with copyable code blocks, visible reasoning traces, stop and regenerate, searchable history. The picker shows what each model has left before you send.",
      },
      {
        title: "OpenAI Compatible API",
        text: "Point the openai SDK at /v1 with an ohs_ key. Chat completions, streaming and tool calling, with errors in the OpenAI shape. Nothing else in your code changes.",
      },
      {
        title: "Live Quota",
        text: "Exact remaining percentage per model, read straight from the provider, with a countdown to the next reset. Shown on the dashboard and in the model picker.",
      },
      {
        title: "Every Plan, One Key",
        text: "Connect Google AI today, and ChatGPT, Claude and SuperGrok as they land. Each account brings its own plan and quota, and all of them sit behind the same ohs_ key.",
      },
    ],
  },
  how: {
    eyebrow: "How It Works",
    title: "From Subscription to First Call.",
    intro: "Three steps and no card. The plan you connect is the only plan involved.",
    steps: [
      {
        title: "Connect an Account",
        text: "Sign in with the provider and paste back the code it shows you. Ohshi reads which models your plan includes and how much each has left.",
      },
      {
        title: "Pick a Model",
        text: "Choose from the picker in chat or by model id in the API. Both the picker and the dashboard show live remaining quota for every model.",
      },
      {
        title: "Chat, or Call /v1",
        text: "Start a chat, or create an ohs_ key and point your code at /v1. Either way the request runs on your subscription. Ohshi adds no quota of its own.",
      },
    ],
  },
  providers: {
    eyebrow: "Providers",
    title: "The Plans You Already Pay For.",
    intro:
      "Google AI connects today. ChatGPT, Claude and SuperGrok are next. Every account you connect shows up in the same picker and behind the same key, each with its own quota.",
    hub: "Ohshi",
    hubSub: "one ohs_ key",
    outputs: [
      { label: "Chat Workspace", sub: "ohshi.space/app" },
      { label: "API", sub: "ohshi.space/v1" },
    ],
    liveLabel: "Live",
    soonLabel: "Next",
    plansLabel: "Plans",
    modelsLabel: "Models",
  },
  models: {
    eyebrow: "Models",
    title: "Whatever Your Plan Lists.",
    intro:
      "Connect a Google AI plan today and the picker shows Gemini 3.6 Flash, Gemini 3.5 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, Claude Opus 4.6 with thinking and GPT-OSS 120B, each with its remaining percentage and reset countdown. When a provider adds a model, it appears in the picker and at /v1 with no change on your side.",
  },
  quota: {
    eyebrow: "Live Quota",
    title: "See What Is Left Before You Send.",
    paragraph:
      "Every subscription has limits that reset on a clock. Ohshi reads the exact remaining percentage for every model straight from the provider and shows it on the dashboard and in the picker, with a countdown to the next reset. No surprises halfway through a run.",
    bullets: [
      "Per model and per account, read live from the provider.",
      "Quota is enforced per endpoint. When one refuses a call, Ohshi tries the next and remembers what worked.",
      "Connect several accounts and pick a default. Each shows its own remaining quota.",
    ],
  },
  developers: {
    eyebrow: "Developers",
    title: "Swap the Base URL and the Key.",
    paragraph:
      "Ohshi serves an OpenAI compatible API at /v1. Create an ohs_ key on the dashboard, set the base URL to ohshi.space/v1, and your existing chat completion calls run on your subscription. Errors keep the OpenAI shape, so your error handling stands. Prompts sent to /v1 are never stored; only usage metadata is kept.",
    bullets: [
      "Chat completions, streaming and tool calling.",
      "One key for every plan you connect. No provider API keys, no credits to top up.",
      "reasoning_effort of low, medium or high selects the model variant.",
      "Keys start with ohs_ and are stored hashed.",
    ],
    integrations: ["openai SDK", "LangChain", "LlamaIndex", "Vercel AI SDK", "cURL"],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Before You Connect.",
    items: [
      {
        q: "Whose Quota Does This Use?",
        a: "Yours. Every call runs on the subscription of the account you connect and counts against its limits. Ohshi adds no quota, sells no model access and is not affiliated with Google, OpenAI, Anthropic or xAI.",
      },
      {
        q: "Do I Still Need API Keys From the Providers?",
        a: "No. The only key you create is the ohs_ key on the dashboard. Your subscription is the plan behind it, so there are no API credits to buy and nothing to top up.",
      },
      {
        q: "Which Subscriptions Work Today?",
        a: "Google AI plans connect today. ChatGPT, Claude and SuperGrok are next. Each account you connect appears in the picker and behind the same ohs_ key, with its own quota.",
      },
      {
        q: "Is My Account Safe With You?",
        a: "Provider tokens are encrypted at rest, passwords are hashed with Argon2id and API keys are stored hashed. Prompts sent to /v1 are never stored, only usage metadata. Chats are saved so you can search them.",
      },
      {
        q: "Will My Existing openai Code Work?",
        a: "Yes. Change the base URL to /v1 and the key to an ohs_ key. Chat completions, streaming and tool calling behave as before, and errors keep the OpenAI shape. LangChain, LlamaIndex, the Vercel AI SDK and cURL work too.",
      },
      {
        q: "Can I Connect More Than One Account?",
        a: "Yes. Connect several, on one provider or across them, and pick one as the default. Each brings its own plan and quota, and the dashboard shows what each has left.",
      },
      {
        q: "What Does Ohshi Cost?",
        a: "Nothing during beta, and there is nothing to buy from Ohshi. The only plans involved are the subscriptions you already hold.",
      },
    ],
  },
  cta: {
    title: "Start With the Plans You Have.",
    text: "Sign up, connect an account and use the same models from chat and from /v1. Free during beta, with nothing to buy.",
    primary: "Create an Account",
    secondary: "Read the Docs",
  },
  footer: {
    tagline: "Chat and an OpenAI compatible API on the AI subscriptions you already pay for.",
    disclaimer:
      "Ohshi is an independent service, not affiliated with Google, OpenAI, Anthropic or xAI. Models and quota come from the subscription on the account you connect.",
  },
};
