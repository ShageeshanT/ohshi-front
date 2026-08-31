/** The Ohshi brand, theme-aware. Dark-ink art on the light theme, chrome art
 *  on the dark theme. The lock-up (mark + OHSHI) is the "wordmark". */

import markOnDark from "../assets/mark-on-dark.webp";
import markOnLight from "../assets/mark-on-light.webp";
import wordmarkOnDark from "../assets/wordmark-on-dark.webp";
import wordmarkOnLight from "../assets/wordmark-on-light.webp";
import { useTheme } from "../lib/theme";

export function useBrandArt() {
  const { theme } = useTheme();
  return theme === "dark"
    ? { mark: markOnDark, wordmark: wordmarkOnDark }
    : { mark: markOnLight, wordmark: wordmarkOnLight };
}

/** The compact spire mark. Height-driven — the art is taller than wide. */
export function BrandMark(props: { className?: string; glow?: boolean }) {
  const { mark } = useBrandArt();
  return (
    <img
      src={mark}
      alt=""
      aria-hidden
      draggable={false}
      className={`w-auto select-none ${props.glow ? "brand-glow" : ""} ${props.className ?? "h-8"}`}
    />
  );
}

/** The full lock-up: mark + OHSHI. */
export function Wordmark(props: { className?: string; glow?: boolean }) {
  const { wordmark } = useBrandArt();
  return (
    <img
      src={wordmark}
      alt="Ohshi"
      draggable={false}
      className={`w-auto select-none ${props.glow ? "brand-glow" : ""} ${props.className ?? "h-8"}`}
    />
  );
}

/** Alias kept for older call sites. */
export function Brand(props: { className?: string }) {
  return <Wordmark className={props.className ?? "h-9"} />;
}

/** The big landing lock-up for the chat's empty state. */
export function BrandHero() {
  return (
    <div className="flex flex-col items-center">
      <Wordmark className="h-16 md:h-24" />
    </div>
  );
}
