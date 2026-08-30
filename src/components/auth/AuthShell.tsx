/**
 * AuthShell — the two-up sign in layout, after the AlcaNest CAGS pattern.
 *
 *   • The page is locked to one screen — 100svh, no scroll — and every measure
 *     in the card is clamped against the window height so the whole form fits.
 *   • The hexagon tiles fill the viewport behind it.
 *   • The brand artwork takes one half of the screen on desktop, its inner edge
 *     feathered so it dissolves into the tiles instead of butting against them.
 *   • The form lives on the other half inside a glass card, with the theme
 *     toggle in its header rather than floating over its corner.
 *
 * Sign in carries the art on the right, sign up on the left, so moving between
 * the two pages reads as a flip rather than a reload.
 *
 * The artwork is not rendered below lg, so phones never fetch it.
 */

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import heroDark from "../../assets/hero-dark.webp";
import heroLight from "../../assets/hero-light.webp";
import { useTheme } from "../../lib/theme";
import { Wordmark } from "../brand";
import { TilesBackdrop } from "../marketing/Backdrop";
import { ThemeToggle } from "../marketing/ThemeToggle";

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

function useIsDesktop() {
  const [wide, setWide] = useState(() => window.matchMedia?.("(min-width: 1024px)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}

export function AuthShell(props: {
  /** Which half the artwork takes. */
  side: "left" | "right";
  caption: string;
  captionSub: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { theme } = useTheme();
  const showArt = useIsDesktop();
  const artOnLeft = props.side === "left";

  return (
    <div className="auth-shell relative">
      <TilesBackdrop />

      <Link
        to="/"
        className="mk-nav absolute left-4 top-4 z-30 inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-semibold text-ink transition-colors hover:text-accent sm:left-6 sm:top-5"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Site
      </Link>

      <div className="relative z-10 grid h-full lg:grid-cols-2">
        {showArt && (
          <motion.aside
            className={`relative hidden h-full overflow-hidden lg:block ${artOnLeft ? "" : "lg:order-2"}`}
            initial={{ opacity: 0, x: artOnLeft ? -48 : 48 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.1, ease: EASE_EXPO }}
          >
            {/* The painting, its inner edge feathered into the tiles. */}
            <div
              className="absolute inset-0"
              style={{
                maskImage: `linear-gradient(to ${artOnLeft ? "left" : "right"}, transparent 0%, #000 24%)`,
                WebkitMaskImage: `linear-gradient(to ${artOnLeft ? "left" : "right"}, transparent 0%, #000 24%)`,
              }}
            >
              <img
                src={theme === "dark" ? heroDark : heroLight}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover object-[62%_top]"
              />
              {/* Reading scrim for the caption. A gradient, not a backdrop
                  filter, so it costs nothing per frame. */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    theme === "dark"
                      ? "linear-gradient(to top, rgba(6,10,22,0.94) 0%, rgba(6,10,22,0.64) 24%, rgba(6,10,22,0.14) 46%, rgba(6,10,22,0) 66%)"
                      : "linear-gradient(to top, rgba(247,247,249,0.96) 0%, rgba(247,247,249,0.78) 24%, rgba(247,247,249,0.22) 46%, rgba(247,247,249,0) 66%)",
                }}
              />
            </div>

            <motion.div
              className="absolute inset-x-10 bottom-[clamp(1.5rem,5vh,2.5rem)] max-w-[27rem]"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.5, ease: EASE_EXPO }}
            >
              <p className="auth-title font-extrabold tracking-tight text-ink">{props.caption}</p>
              <p className="auth-gap-sm text-[13px] leading-relaxed text-ink-dim">{props.captionSub}</p>
            </motion.div>
          </motion.aside>
        )}

        {/* justify-center plus my-auto on the card: centred when it fits, and
            still scrollable from the top on a window too small to hold it. */}
        <main
          className={`auth-main relative flex h-full flex-col justify-center overflow-y-auto px-5 sm:px-8 lg:px-10 ${
            artOnLeft ? "auth-main-free" : ""
          }`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl"
          />
          <motion.div
            className="relative my-auto w-full max-w-md"
            initial={{ opacity: 0, y: 26, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.85, delay: 0.12, ease: EASE_EXPO }}
          >
            <div className="glass auth-card">
              <div className="flex items-start justify-between gap-3">
                <Link to="/" aria-label="Ohshi home" className="inline-block">
                  <Wordmark className="h-[clamp(24px,4.2vh,36px)]" />
                </Link>
                <ThemeToggle compact />
              </div>

              <p className="auth-gap text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                {props.eyebrow}
              </p>
              <h1 className="auth-gap-sm auth-title font-extrabold tracking-tight">{props.title}</h1>
              <p className="auth-gap-sm text-[13px] leading-snug text-ink-dim">{props.subtitle}</p>

              <div className="auth-gap">{props.children}</div>

              {props.footer && (
                <div className="auth-gap border-t border-edge pt-[clamp(0.6rem,1.8vh,1.25rem)] text-center text-[13px] text-ink-dim">
                  {props.footer}
                </div>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
