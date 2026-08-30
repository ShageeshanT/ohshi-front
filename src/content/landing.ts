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
 * Every claim here is true of the product. Keep it that way when editing.
 */

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
  features: { eyebrow: string; title: string; intro: string; cards: { title: string; text: string }[] };
  how: { eyebrow: string; title: string; steps: { title: string; text: string }[] };
  models: { eyebrow: string; title: string; intro: string };
  developers: { eyebrow: string; title: string; paragraph: string; bullets: string[] };
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
  cta: { title: string; text: string; primary: string; secondary: string };
  footer: { tagline: string; disclaimer: string };
}

export const COPY: LandingCopy = {
  nav: ["Features", "How It Works", "Models", "Developers", "FAQ"],
  hero: {
    badge: "Free During Beta",
    line1: "Your Google Plan.",
    line2: "Now an API.",
    paragraph:
      "Ohshi is a chat workspace and an OpenAI compatible API for the models on your Google AI plan. Connect your account and every call runs on your quota.",
    primaryCta: "Get Started",
    secondaryCta: "See the API",
    trust: ["Bring Your Own Plan", "Live Quota Per Model", "Tokens Encrypted at Rest"],
  },
  features: {
    eyebrow: "Features",
    title: "Put Your Google Plan to Work.",
    intro:
      "Connect a Google account and you get a chat workspace, an OpenAI compatible API and a live quota readout. Every request runs on the plan you already have.",
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
        text: "Exact remaining percentage per model, read straight from Google, with a countdown to the next reset. Shown on the dashboard and in the model picker.",
      },
      {
        title: "Automatic Failover",
        text: "Google enforces quota per endpoint. When one endpoint refuses a call, Ohshi tries the next and remembers what worked. Connect several accounts and pick a default.",
      },
    ],
  },
  how: {
    eyebrow: "How It Works",
    title: "From Google Account to First Call.",
    steps: [
      {
        title: "Connect a Google Account",
        text: "Sign up, sign in with Google and paste back the code it shows you. Ohshi reads which models your plan lists and how much each has left.",
      },
      {
        title: "Pick a Model",
        text: "Choose from the picker in chat or by model id in the API. Both the picker and the dashboard show live remaining quota for every model.",
      },
      {
        title: "Chat, or Call /v1",
        text: "Start a chat, or create an ohs_ key and point your code at /v1. Either way the request runs on your Google quota. Ohshi adds none of its own.",
      },
    ],
  },
  models: {
    eyebrow: "Models",
    title: "Whatever Your Google Plan Lists.",
    intro:
      "Depending on the plan, that is Gemini 3.6 Flash, Gemini 3.5 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, Claude Opus 4.6 with thinking and GPT-OSS 120B. Each one shows its remaining percentage and reset countdown. When Google adds a model, it appears in the picker and at /v1 with no change on your side.",
  },
  developers: {
    eyebrow: "Developers",
    title: "Swap the Base URL and the Key.",
    paragraph:
      "Ohshi serves an OpenAI compatible API at /v1. Create an ohs_ key on the dashboard, set the base URL to ohshi.space/v1, and your existing chat completion calls run on your Google plan. Errors keep the OpenAI shape, so your error handling stands. Prompts sent to /v1 are never stored; only usage metadata is kept.",
    bullets: [
      "Chat completions, streaming and tool calling.",
      "Works with the openai SDKs, LangChain, LlamaIndex, the Vercel AI SDK and cURL.",
      "reasoning_effort of low, medium or high selects the model variant.",
      "Keys start with ohs_ and are stored hashed.",
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Before You Connect.",
    items: [
      {
        q: "Whose Quota Does This Use?",
        a: "Yours. Every call runs on the Google AI plan of the account you connect and counts against its limits. Ohshi adds no quota, sells no model access and is not affiliated with Google, Anthropic or OpenAI.",
      },
      {
        q: "Is My Google Account Safe With You?",
        a: "Google tokens are encrypted at rest, passwords are hashed with Argon2id and API keys are stored hashed. Prompts sent to /v1 are never stored, only usage metadata. Chats are saved so you can search them.",
      },
      {
        q: "Will My Existing openai Code Work?",
        a: "Yes. Change the base URL to /v1 and the key to an ohs_ key. Chat completions, streaming and tool calling behave as before, and errors keep the OpenAI shape. LangChain, LlamaIndex, the Vercel AI SDK and cURL work too.",
      },
      {
        q: "Can I Connect More Than One Google Account?",
        a: "Yes. Connect several and pick one as the default. Each brings its own plan and quota, and the dashboard shows what each has left.",
      },
      {
        q: "What Does Ohshi Cost?",
        a: "Nothing during beta, and there is nothing to buy from Ohshi. The only plan involved is the Google one you already hold.",
      },
    ],
  },
  cta: {
    title: "Start With the Plan You Have.",
    text: "Sign up, connect a Google account and use the same models from chat and from /v1. Free during beta, with nothing to buy.",
    primary: "Create an Account",
    secondary: "Read the Docs",
  },
  footer: {
    tagline: "Chat and an OpenAI compatible API on your own Google plan.",
    disclaimer:
      "Ohshi is an independent service, not affiliated with Google, Anthropic or OpenAI. Models and quota come from the Google AI plan on the account you connect.",
  },
};
