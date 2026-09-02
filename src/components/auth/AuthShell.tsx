/**
 * AuthShell — the frame around sign in and sign up: a plain page, the lock-up,
 * one bordered card with the form, and a line under it. Nothing else.
 */

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "../brand";
import { ThemeToggle } from "../marketing/ThemeToggle";

const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

export function AuthShell(props: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-ink-dim transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to site
        </Link>
        <ThemeToggle compact />
      </div>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[6vh] sm:items-center sm:pt-0">
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
      </main>
    </div>
  );
}
