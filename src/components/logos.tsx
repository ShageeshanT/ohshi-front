/**
 * Brand marks for the model/account cards — clean inline SVGs, no external
 * fetches. Every mark inherits `currentColor` so it tints with the chip it
 * sits in. Contract: viewBox 0 0 24 24, default size h-5 w-5, overridable.
 */

import { VenetianMask } from "lucide-react";
import { useBrandArt } from "./brand";

interface LogoProps {
  className?: string;
}

/** Ohshi's own mark, for ohs3 / ohs3-pro. The art is theme-specific and
 *  taller than wide; object-contain keeps it inside whatever box it gets. */
export function OhshiLogo({ className }: LogoProps) {
  const { mark } = useBrandArt();
  return (
    <img
      src={mark}
      alt=""
      aria-hidden
      draggable={false}
      className={`select-none object-contain ${className ?? "h-5 w-5"}`}
    />
  );
}

const EIGHT = [0, 45, 90, 135, 180, 225, 270, 315];
const SIX = [0, 60, 120, 180, 240, 300];

/** Anthropic's starburst — an 8-spoke radial burst of rounded slabs. */
const CLAUDE_SPOKE = "M10.8 8.6 L10.8 3.6 A1.2 1.2 0 0 1 13.2 3.6 L13.2 8.6 A1.2 1.2 0 0 1 10.8 8.6 Z";

export function ClaudeLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "h-5 w-5"} aria-hidden="true">
      {EIGHT.map((a) => (
        <path key={a} d={CLAUDE_SPOKE} transform={`rotate(${a} 12 12)`} />
      ))}
    </svg>
  );
}

/** OpenAI's hexagonal knot — six tilted petals interlocking into a ring. */
const OPENAI_PETAL = "M10.65 7.65 L10.65 3.95 A1.35 1.35 0 0 1 13.35 3.95 L13.35 7.65 A1.35 1.35 0 0 1 10.65 7.65 Z";

export function OpenAILogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "h-5 w-5"} aria-hidden="true">
      {SIX.map((a) => (
        <path key={a} d={OPENAI_PETAL} transform={`rotate(${a} 12 12) rotate(33 12 5.8)`} />
      ))}
    </svg>
  );
}

/** Gemini's four-point sparkle — a star with concave edges. */
export function GeminiLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "h-5 w-5"} aria-hidden="true">
      <path d="M12 2 C12.55 7.45 16.55 11.45 22 12 C16.55 12.55 12.55 16.55 12 22 C11.45 16.55 7.45 12.55 2 12 C7.45 11.45 11.45 7.45 12 2 Z" />
    </svg>
  );
}

/** Google's G, in the four brand colours (used on the account cards). */
export function GoogleLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-5 w-5"} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.55-5.17 3.55-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.26a12 12 0 0 0 0 10.76l4.01-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/** xAI's mark — a slanted X whose leading stroke is cut short. Two rounded
 *  bars and a stub, so it still reads at 20px. */
export function XaiLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.7}
      strokeLinecap="round"
      className={className ?? "h-5 w-5"}
      aria-hidden="true"
    >
      <path d="M4.6 4.6 L19.4 19.4" />
      <path d="M19.4 4.6 L13.1 10.9" />
      <path d="M9.2 14.8 L4.6 19.4" />
    </svg>
  );
}

/** DeepSeek's whale — a rounded body swimming right, a forked tail on the
 *  left, an eye punched out with the even-odd rule so it needs no second
 *  colour. Reads as a whale from 14px up. */
export function DeepSeekLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className ?? "h-5 w-5"} aria-hidden="true">
      <path d="M5.6 12.4 C7.3 8.9 10.4 7 14.3 7.1 C17.7 7.2 20.4 8.9 21.6 11.4 C20.5 11.9 19.6 12.9 19.1 14.1 C17.6 16 14.9 16.9 12 16.6 C9.4 16.3 7.2 15.1 5.6 13.3 Z M5.6 12.4 C4.6 10.9 4.4 9.1 4.9 7.5 C6.4 8.6 7.3 10.3 7.5 12.1 Z M5.6 13.3 C4.2 14.4 3.4 16.2 3.6 18 C5.4 17.3 6.7 15.9 7.4 14.2 Z M17.2 10.2 a1.05 1.05 0 1 0 0.001 0 Z" />
    </svg>
  );
}

/** Fallback mark — a circuit node: hub with three linked nodes. */
export function ModelFallbackLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "h-5 w-5"} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        <path d="M12 12 L12 4.5" />
        <path d="M12 12 L18.6 15.8" />
        <path d="M12 12 L5.4 15.8" />
      </g>
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="12" cy="4.5" r="1.8" />
      <circle cx="18.6" cy="15.8" r="1.8" />
      <circle cx="5.4" cy="15.8" r="1.8" />
    </svg>
  );
}

/** The right mark for a model family's vendor. */
/** The admins' Uncensored model (a mask — it is not any vendor's mark). */
export function UncensoredLogo({ className }: LogoProps) {
  return <VenetianMask className={className ?? "h-5 w-5"} aria-hidden />;
}

export function vendorLogo(vendor: string) {
  if (vendor === "ohshi") return OhshiLogo;
  if (vendor === "uncensored") return UncensoredLogo;
  if (vendor === "anthropic") return ClaudeLogo;
  if (vendor === "openai") return OpenAILogo;
  if (vendor === "google") return GeminiLogo;
  if (vendor === "deepseek") return DeepSeekLogo;
  if (vendor === "xai") return XaiLogo;
  return ModelFallbackLogo;
}
