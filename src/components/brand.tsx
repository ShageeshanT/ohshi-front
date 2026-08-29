/** The Ohshi brand: the dripping mark and the grunge wordmark. */

import markUrl from "../assets/ohshi-mark.webp";
import wordmarkUrl from "../assets/ohshi-wordmark.webp";

/** The mark on its own. Height-driven — the art is taller than it is wide, so
 *  never pin both dimensions or it distorts. */
export function BrandMark(props: { className?: string; glow?: boolean }) {
  return (
    <img
      src={markUrl}
      alt=""
      aria-hidden
      draggable={false}
      className={`w-auto select-none ${props.glow ? "brand-glow" : ""} ${props.className ?? "h-8"}`}
    />
  );
}

/** The "OHSHI" wordmark. */
export function Wordmark(props: { className?: string }) {
  return (
    <img
      src={wordmarkUrl}
      alt="Ohshi"
      draggable={false}
      className={`w-auto select-none ${props.className ?? "h-6"}`}
    />
  );
}

/** Mark + wordmark, side by side (login, mobile header). */
export function Brand(props: { dark?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${props.className ?? ""}`}>
      <BrandMark className="h-9" />
      <Wordmark className="h-6" />
    </div>
  );
}

/** The big landing lock-up: a glowing mark over the wordmark. */
export function BrandHero() {
  return (
    <div className="flex flex-col items-center gap-4">
      <BrandMark className="brand-float h-20 md:h-24" glow />
      <Wordmark className="h-11 md:h-14" />
    </div>
  );
}
