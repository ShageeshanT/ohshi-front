/**
 * The floating glass navigation pill. Full-width pearly pill at the top of the
 * page (lock-up left, links centered, theme chip + Sign In + Get Started on
 * the right); once you scroll it springs into a compact pill and the lock-up
 * crossfades to the bare mark. Spring values from the AlcaNest navbar.
 */

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../App";
import { COPY } from "../../content/landing";
import { useBrandArt } from "../brand";
import { ThemeToggle } from "./ThemeToggle";

const spring = { type: "spring" as const, stiffness: 260, damping: 32, mass: 0.8 };

const HASHES = ["#features", "#how", "#models", "#pricing", "#developers", "#faq"];
export const NAV_LINKS = HASHES.map((hash, i) => ({ hash, label: COPY.nav[i] ?? hash.slice(1) }));

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

export function MarketingNav(props: { minimal?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { me } = useAuth();
  /* A 1080p panel at the Windows 150% scale is a 640 CSS pixel tall viewport,
     where the resting pill would eat a sixth of the screen; a phone is too
     narrow for it at full size. Both get the same denser lock-up. */
  const short = useMediaQuery("(max-height: 760px)");
  const narrow = useMediaQuery("(max-width: 480px)");
  const dense = short || narrow;
  const { mark, wordmark } = useBrandArt();
  const lenis = useLenis();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (hash: string) => {
    setOpen(false);
    if (location.pathname !== "/") {
      navigate(`/${hash}`);
      return;
    }
    const el = document.querySelector<HTMLElement>(hash);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -110 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* The lock-up art is 152x60; the pill wears it at 46 high at rest and smaller
     still on a tight window, which is what sets the whole bar's height. */
  const lockupH = narrow ? 36 : dense ? 40 : 46;
  const lockupW = Math.round((lockupH * 152) / 60);

  const actions = me ? (
    <Link to="/app" className="btn-primary btn-sm">
      Open app <ArrowRight className="h-4 w-4" />
    </Link>
  ) : (
    <>
      <Link to="/login" className="btn-ghost btn-sm hidden sm:inline-flex">
        Sign In
      </Link>
      <Link to="/signup" className="btn-primary btn-sm">
        Get Started <ArrowRight className="h-4 w-4" />
      </Link>
    </>
  );

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 sm:px-7 lg:px-9">
      <motion.div
        initial={false}
        animate={{
          marginTop: scrolled ? 9 : dense ? 12 : 16,
          maxWidth: scrolled ? 960 : 1380,
          paddingTop: scrolled ? 6 : dense ? 7 : 9,
          paddingBottom: scrolled ? 6 : dense ? 7 : 9,
          paddingLeft: scrolled ? 15 : narrow ? 15 : dense ? 18 : 24,
          paddingRight: scrolled ? 7 : narrow ? 7 : dense ? 9 : 12,
        }}
        transition={spring}
        className={`mk-nav pointer-events-auto relative mx-auto flex items-center rounded-full ${
          scrolled ? "mk-nav-scrolled" : ""
        }`}
      >
        <div className="mk-nav-sheen" aria-hidden />

        {/* Logo: lock-up when expanded, bare mark once scrolled. Both stay
            mounted so the crossfade never causes a layout jump. */}
        <div className="flex flex-1 items-center">
          <Link to="/" aria-label="Ohshi home" className="relative block shrink-0">
            <motion.span
              initial={false}
              animate={{ width: scrolled ? 34 : lockupW, height: scrolled ? 36 : lockupH }}
              transition={spring}
              className="relative block"
            >
              <motion.img
                src={wordmark}
                alt="Ohshi"
                draggable={false}
                initial={false}
                animate={{ opacity: scrolled ? 0 : 1, scale: scrolled ? 0.85 : 1, height: lockupH }}
                transition={{ duration: 0.22, height: spring }}
                className="absolute left-0 top-0 w-auto select-none"
                style={{ transformOrigin: "left center" }}
              />
              <motion.img
                src={mark}
                alt=""
                aria-hidden
                draggable={false}
                initial={false}
                animate={{ opacity: scrolled ? 1 : 0, scale: scrolled ? 1 : 0.8 }}
                transition={{ duration: 0.22 }}
                className="absolute left-0 top-0 h-[36px] w-auto select-none"
                style={{ transformOrigin: "left center" }}
              />
            </motion.span>
          </Link>
        </div>

        {!props.minimal && (
          <nav className={`mx-5 hidden shrink-0 items-center lg:flex ${scrolled ? "gap-5" : "gap-7"}`}>
            {NAV_LINKS.map((l) => (
              <button
                key={l.hash}
                type="button"
                onClick={() => go(l.hash)}
                className={`mk-link ${scrolled ? "mk-link-sm" : ""}`}
              >
                {l.label}
              </button>
            ))}
          </nav>
        )}

        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2.5">
          <ThemeToggle compact={scrolled} className="hidden sm:inline-flex" />
          {actions}
          {!props.minimal && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mk-chip lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {open && !props.minimal && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="mk-nav pointer-events-auto mx-auto mt-2 max-w-[1460px] rounded-3xl p-3 lg:hidden"
          >
            <div className="grid gap-1">
              {NAV_LINKS.map((l) => (
                <button
                  key={l.hash}
                  type="button"
                  onClick={() => go(l.hash)}
                  className="rounded-2xl px-4 py-3 text-left text-[15px] font-medium text-ink transition-colors hover:bg-ink/[0.06]"
                >
                  {l.label}
                </button>
              ))}
              <div className="mt-2 flex items-center gap-2 border-t border-edge pt-3">
                <ThemeToggle />
                {!me && (
                  <Link to="/login" className="btn-ghost btn-sm">
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
