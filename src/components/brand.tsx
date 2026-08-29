/** The Ohshi mark (a ring on a dark tile) and wordmark, in a few sizes. */

export function BrandMark(props: { className?: string; light?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl ${
        props.light ? "bg-white/10" : "bg-night"
      } ${props.className ?? "h-8 w-8"}`}
      aria-hidden
    >
      <span className="block h-[44%] w-[44%] rounded-full border-[3px] border-white" />
    </span>
  );
}

export function Brand(props: { dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${props.dark ? "text-ink" : "text-white"}`}>
      <BrandMark light={!props.dark} />
      <span className="text-lg font-semibold tracking-tight">Ohshi</span>
    </div>
  );
}

/** The big landing brand (chat page, empty state). */
export function BrandHero() {
  return (
    <div className="flex items-center gap-4 text-ink">
      <BrandMark className="h-14 w-14 rounded-2xl md:h-16 md:w-16" />
      <span className="text-5xl font-semibold tracking-tight md:text-6xl">Ohshi</span>
    </div>
  );
}
