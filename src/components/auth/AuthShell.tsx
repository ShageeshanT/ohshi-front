/**
 * AuthShell — the two-up sign in layout.
 *
 *   • The painting takes one half of the screen on desktop, whole and
 *     unwashed, with a hairline where it meets the form.
 *   • The form lives on the other half: the lock-up, one bordered card and a
 *     line under it, on the plain page colour.
 *
 * Sign in carries the art on the right, sign up on the left, so moving between
 * the two pages reads as a flip rather than a reload. Each page has its own
 * painting in each theme, so the theme switch changes the view too.
 *
 * The artwork is not rendered below lg, so phones never fetch it.
 */

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import loginDark from "../../assets/auth-login-dark.webp";
import loginLight from "../../assets/auth-login-light.webp";
import signupDark from "../../assets/auth-signup-dark.webp";
import signupLight from "../../assets/auth-signup-light.webp";
import { useTheme } from "../../lib/theme";
import { Wordmark } from "../brand";
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

/** The four paintings, keyed by page and theme. */
const ART = {
  login: { light: loginLight, dark: loginDark },
  signup: { light: signupLight, dark: signupDark },
};

export function AuthShell(props: {
  /** Picks the painting and, with it, the half the artwork takes. */
  page: "login" | "signup";
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { theme } = useTheme();
  const showArt = useIsDesktop();
  const artOnLeft = props.page === "signup";
  const art = ART[props.page][theme === "dark" ? "dark" : "light"];

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-2">
      {showArt && (
        <motion.aside
          key={`${props.page}-${theme}`}
          className={`auth-art relative hidden min-h-screen overflow-hidden lg:block ${
            artOnLeft ? "border-r border-edge" : "border-l border-edge lg:order-2"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE_EXPO }}
        >
          <img src={art} alt="" aria-hidden draggable={false} />
        </motion.aside>
      )}

      <main className="relative flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-ink-dim transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
          <ThemeToggle compact />
        </div>

        <div className="flex flex-1 items-start justify-center px-4 pb-16 pt-[6vh] sm:items-center sm:pt-0">
          <motion.div
            className="w-full max-w-[400px]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE_EXPO }}
          >
            <div className="mb-6 flex justify-center">
              <Link to="/" aria-label="Ohshi home">
                <Wordmark className="h-7" />
              </Link>
            </div>
            <div className="card p-6 sm:p-7">
              <h1 className="text-[20px] font-semibold tracking-tight">{props.title}</h1>
              {props.subtitle && <p className="mt-1 text-[13px] text-ink-dim">{props.subtitle}</p>}
              <div className="mt-5">{props.children}</div>
            </div>
            {props.footer && <p className="mt-5 text-center text-[13px] text-ink-dim">{props.footer}</p>}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
