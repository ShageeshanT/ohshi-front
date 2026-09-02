/**
 * Hand-drawn accents: a few loose strokes in `currentColor` for the plan
 * cards and the landing's closing card. Round caps, slightly wobbly paths,
 * nothing filled, so they read as pen on paper rather than icons.
 */

interface DoodleProps {
  className?: string;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** A four-point sparkle with two small stars beside it. */
export function SparkleDoodle({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 64 64" className={className ?? "h-14 w-14"} aria-hidden {...stroke}>
      <path d="M30 10 C31 20 36 25 46 26 C36 27 31 32 30 42 C29 32 24 27 14 26 C24 25 29 20 30 10 Z" />
      <path d="M50 40 C50.5 44 52.5 46 56 46.5 C52.5 47 50.5 49 50 53 C49.5 49 47.5 47 44 46.5 C47.5 46 49.5 44 50 40 Z" />
      <path d="M13 44 L13 52 M9 48 L17 48" />
    </svg>
  );
}

/** A paper plane with a dotted trail. */
export function PlaneDoodle({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 64 64" className={className ?? "h-14 w-14"} aria-hidden {...stroke}>
      <path d="M12 30 L54 14 L40 52 L31 36 Z" />
      <path d="M31 36 L54 14" />
      <path d="M8 44 C11 42 13 42 16 44" strokeDasharray="1 4" />
      <path d="M6 52 C10 49 14 49 20 52" strokeDasharray="1 4" />
    </svg>
  );
}

/** A little rocket, lit. */
export function RocketDoodle({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 64 64" className={className ?? "h-14 w-14"} aria-hidden {...stroke}>
      <path d="M36 10 C46 14 50 26 44 40 L28 40 C22 26 26 14 36 10 Z" />
      <circle cx="36" cy="24" r="4" />
      <path d="M28 34 C22 34 18 38 18 44 L26 42" />
      <path d="M44 34 C50 34 54 38 54 44 L46 42" />
      <path d="M32 44 C33 50 36 53 36 53 C36 53 39 50 40 44" />
      <path d="M10 52 L14 48 M8 58 L16 50" />
    </svg>
  );
}

/** A loose arrow that loops once before it lands. */
export function ArrowLoopDoodle({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 96 48" className={className ?? "h-10 w-20"} aria-hidden {...stroke}>
      <path d="M6 36 C24 34 30 12 44 12 C56 12 56 30 44 30 C34 30 36 16 48 14 C64 12 74 22 88 26" />
      <path d="M80 20 L89 26 L80 32" />
    </svg>
  );
}

/** A wobbly underline for one word. Stretches to its box. */
export function SquiggleDoodle({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 200 12" preserveAspectRatio="none" className={className ?? "h-2.5 w-full"} aria-hidden {...stroke}>
      <path d="M2 8 C20 2 30 2 50 8 C70 12 80 12 100 6 C120 1 130 1 150 7 C170 12 180 12 198 5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Scattered stars for a corner. */
export function StarsDoodle({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 120 80" className={className ?? "h-16 w-24"} aria-hidden {...stroke}>
      <path d="M20 18 L20 30 M14 24 L26 24" />
      <path d="M62 8 C62.5 13 65 15.5 70 16 C65 16.5 62.5 19 62 24 C61.5 19 59 16.5 54 16 C59 15.5 61.5 13 62 8 Z" />
      <path d="M98 30 L98 38 M94 34 L102 34" />
      <path d="M40 58 C40.5 61 42 62.5 45 63 C42 63.5 40.5 65 40 68 C39.5 65 38 63.5 35 63 C38 62.5 39.5 61 40 58 Z" />
      <path d="M86 60 L86 70 M81 65 L91 65" />
    </svg>
  );
}
