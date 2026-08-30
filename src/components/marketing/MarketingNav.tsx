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

const HASHES = ["#features", "#how", "#models", "#developers", "#faq"];
export const NAV_LINKS = HASHES.map((hash, i) => ({ hash, label: COPY.nav[i] ?? hash.slice(1) }));

export function MarketingNav(props: { minimal?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { me } = useAuth();
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
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 sm:px-7 lg:px-9">
      <motion.div
        initial={false}
        animate={{
          marginTop: scrolled ? 10 : 22,
          maxWidth: scrolled ? 1000 : 1460,
          paddingTop: scrolled ? 7 : 12,
          paddingBottom: scrolled ? 7 : 12,
          paddingLeft: scrolled ? 18 : 30,
          paddingRight: scrolled ? 8 : 14,
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
              animate={{ width: scrolled ? 40 : 152, height: scrolled ? 42 : 60 }}
              transition={spring}
              className="relative block"
            >
              <motion.img
                src={wordmark}
                alt="Ohshi"
                draggable={false}
                initial={false}
                animate={{ opacity: scrolled ? 0 : 1, scale: scrolled ? 0.85 : 1 }}
                transition={{ duration: 0.22 }}
                className="absolute left-0 top-0 h-[60px] w-auto select-none"
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
                className="absolute left-0 top-0 h-[42px] w-auto select-none"
                style={{ transformOrigin: "left center" }}
              />
            </motion.span>
          </Link>
        </div>

        {!props.minimal && (
          <nav className={`mx-6 hidden shrink-0 items-center lg:flex ${scrolled ? "gap-6" : "gap-9"}`}>
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
