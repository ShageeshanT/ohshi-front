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
 * page says it is next, never that it works. Two things are live for Google:
 * the Gemini API key path (supported, billed by Google) and, in Beta, the
 * connector for the Google account behind a plan. The page never presents a
 * consumer subscription as a guaranteed API allowance.
 */

export type ProviderId = "google" | "openai" | "anthropic" | "xai";

export interface Provider {
  id: ProviderId;
  vendor: string;
  /** How access reaches Ohshi: the key or the plans, named as the provider does. */
  plans: string[];
  /** What connecting one of those puts in the picker. */
  models: string;
  /** The connection has shipped. Flip this when a provider goes live. */
  live: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    id: "google",
    vendor: "Google",
    plans: ["Gemini API key from AI Studio", "Google AI Pro and Ultra account (Beta)"],
    models: "Gemini 2.5 and 3 on the key. Gemini, Claude and GPT-OSS through the account",
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
    line1: "One Key.",
    line2: "Chat and API.",
    paragraph:
      "Ohshi turns your own Google AI access into a chat workspace and an OpenAI compatible API. Paste a Gemini API key, or connect the Google account behind your plan in Beta, and every call runs on it through one ohs_ key.",
    primaryCta: "Get Started",
    secondaryCta: "See the API",
    trust: ["Bring Your Own Key or Plan", "Live Quota Per Model", "Keys and Tokens Encrypted at Rest"],
  },
  why: {
    eyebrow: "Why Ohshi",
    title: "Stop Paying Twice for the Same Models.",
    intro:
      "A chat subscription covers the app. API credits cover your code. Same models, two bills, two quotas. Ohshi puts one source behind both: your Gemini API key today, or the plan you already pay for in Beta.",
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
      note: "One source carries both. The ohs_ key is the only key your code sees.",
      source: "Your Google Access",
      sourceSub: "API key, or your plan in Beta",
      hub: "Ohshi",
      hubSub: "one ohs_ key",
      outputs: [
        { label: "Chat Workspace", sub: "The chat page" },
        { label: "Your Agents", sub: "Through /v1" },
      ],
      tally: ["1 source", "1 quota", "1 key"],
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
        text: "A connected Google account reports the exact remaining percentage per model, with a countdown to the next reset. Shown on the dashboard and in the model picker.",
      },
      {
        title: "Every Source, One Key",
        text: "Paste a Gemini API key today, the supported path. Connect Google AI Pro in Beta, with ChatGPT, Claude and SuperGrok next. Every source sits behind the same ohs_ key.",
      },
    ],
  },
  how: {
    eyebrow: "How It Works",
    title: "From Key to First Call.",
    intro:
      "Three steps and nothing to buy from Ohshi. Google bills your API key for what you use; the Beta connector runs on the plan you already hold.",
    steps: [
      {
        title: "Add a Key or Connect an Account",
        text: "Paste a Gemini API key from Google AI Studio, the supported path. Or sign in with Google and paste back the code, in Beta. Ohshi reads which models you can use.",
      },
      {
        title: "Pick a Model",
        text: "Choose from the picker in chat or by model id in the API. A connected Google account also shows live remaining quota for every model.",
      },
      {
        title: "Chat, or Call /v1",
        text: "Start a chat, or create an ohs_ key and point your code at /v1. Either way the request runs on your key or your plan. Ohshi adds no quota of its own.",
      },
    ],
  },
  providers: {
    eyebrow: "Providers",
    title: "Your Key, or the Plan You Already Pay For.",
    intro:
      "A Gemini API key is live today. The Google account connector is in Beta, with ChatGPT, Claude and SuperGrok next. Every source you add shows up in the same picker and behind the same key.",
    hub: "Ohshi",
    hubSub: "one ohs_ key",
    outputs: [
      { label: "Chat Workspace", sub: "ohshi.space/app" },
      { label: "API", sub: "ohshi.space/v1" },
    ],
    liveLabel: "Live",
    soonLabel: "Next",
    plansLabel: "Access",
    modelsLabel: "Models",
  },
  models: {
    eyebrow: "Models",
    title: "Whatever Your Key or Plan Lists.",
    intro:
      "With a Gemini API key the picker lists every chat model that key can call, Gemini 2.5 and Gemini 3 included, and new ones appear by themselves. With a Google account in Beta it shows Gemini 3.6 Flash, Gemini 3.5 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, Claude Opus 4.6 with thinking and GPT-OSS 120B, each with its remaining percentage and reset countdown.",
  },
  quota: {
    eyebrow: "Live Quota",
    title: "See What Is Left Before You Send.",
    paragraph:
      "A connected Google account has limits that reset on a clock. Ohshi reads the exact remaining percentage for every model straight from Google and shows it on the dashboard and in the picker, with a countdown to the next reset. A Gemini API key has no such meter, so Ohshi shows its last outcome and passes Google's rate limit replies through untouched.",
    bullets: [
      "Per model and per account, read live from Google on the Beta connector.",
      "Quota is enforced per endpoint. When one refuses a call, Ohshi tries the next and remembers what worked.",
      "Add several keys and accounts and pick a default. The dashboard shows what each has left and which one is answering.",
    ],
  },
  developers: {
    eyebrow: "Developers",
    title: "Swap the Base URL and the Key.",
    paragraph:
      "Ohshi serves an OpenAI compatible API at /v1. Create an ohs_ key on the dashboard, set the base URL to ohshi.space/v1, and your existing chat completion calls run on your Gemini API key or your plan. Errors keep the OpenAI shape, so your error handling stands. Prompts sent to /v1 are never stored; only usage metadata is kept.",
    bullets: [
      "Chat completions, streaming and tool calling.",
      "One key for every source you add. Your Gemini API key stays on the server, encrypted.",
      "reasoning_effort of low, medium or high sets the thinking depth on the Gemini API and the model variant on the connector.",
      "Keys start with ohs_ and are stored hashed. Burst limits per key and per account keep a leaked key from running away.",
    ],
    integrations: ["openai SDK", "LangChain", "LlamaIndex", "Vercel AI SDK", "cURL"],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Before You Connect.",
    items: [
      {
        q: "Whose Quota Does This Use?",
        a: "Yours. With a Gemini API key, Google bills that key for what you use. With a connected Google account, in Beta, calls run on that plan and count against its limits. Ohshi adds no quota, sells no model access and is not affiliated with Google, OpenAI, Anthropic or xAI.",
      },
      {
        q: "Do I Still Need API Keys From the Providers?",
        a: "The supported path is your own Gemini API key from Google AI Studio. Paste it once; Ohshi keeps it encrypted and your code only ever sees the ohs_ key. The Google account connector runs on your plan without an API key, but it is in Beta and is not a guaranteed API entitlement.",
      },
      {
        q: "Which Providers Work Today?",
        a: "A Gemini API key is live. Connecting a Google AI account is in Beta. ChatGPT, Claude and SuperGrok are next. Each source appears in the picker and behind the same ohs_ key.",
      },
      {
        q: "Is My Account Safe With You?",
        a: "API keys you paste and provider tokens are encrypted at rest, passwords are hashed with Argon2id and ohs_ keys are stored hashed. Prompts sent to /v1 are never stored, only usage metadata. Chats are saved so you can search them.",
      },
      {
        q: "Will My Existing openai Code Work?",
        a: "Yes. Change the base URL to /v1 and the key to an ohs_ key. Chat completions, streaming and tool calling behave as before, and errors keep the OpenAI shape. LangChain, LlamaIndex, the Vercel AI SDK and cURL work too.",
      },
      {
        q: "Can I Add More Than One Source?",
        a: "Yes. Save several Gemini API keys, connect several Google accounts, and pick one as the default. The chat page and the dashboard both let you switch it, and the dashboard shows what each account has left.",
      },
      {
        q: "What Does Ohshi Cost?",
        a: "Nothing during beta. Google bills your Gemini API key directly for what you use, and the Beta connector runs on the plan you already hold.",
      },
    ],
  },
  cta: {
    title: "Start With the Access You Have.",
    text: "Sign up, paste a Gemini API key or connect a Google account, and use the same models from chat and from /v1. Free during beta.",
    primary: "Create an Account",
    secondary: "Read the Docs",
  },
  footer: {
    tagline: "Chat and an OpenAI compatible API on your own Google AI access.",
    disclaimer:
      "Ohshi is an independent service, not affiliated with Google, OpenAI, Anthropic or xAI. Models and quota come from the API key or the account you connect. The Google account connector is in Beta.",
  },
};
