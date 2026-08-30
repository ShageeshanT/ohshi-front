/**
 * The pieces both sign-in engines share, so the page looks identical whether
 * the credential lives in our database or in Clerk: the error line, the Terms
 * checkbox, the social buttons, the "or" rule and the verification code field.
 *
 * Everything here is built from the same `ui.tsx` primitives as the rest of the
 * forms — pill inputs, the accent focus ring, the `.auth-stack` vertical rhythm
 * that keeps sign-up on one screen at 640px tall.
 */

import { Check } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { GoogleLogo } from "../logos";

export function ErrorLine(props: { children?: ReactNode }) {
  if (!props.children) return null;
  return <p className="text-sm font-medium text-danger">{props.children}</p>;
}

/** One mark per provider in `SOCIAL_PROVIDERS`; Google's is in logos.tsx, in
 *  its four brand colours. A provider with no entry just renders label-only. */
const SOCIAL_ICONS: Record<string, (p: { className?: string }) => ReactNode> = {
  oauth_google: GoogleLogo,
};

export function SocialButton(props: {
  strategy: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = SOCIAL_ICONS[props.strategy];
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex w-full items-center justify-center gap-2.5 rounded-full border border-edge bg-panel px-4 py-2.5 text-sm font-semibold text-ink transition duration-200 hover:border-ink/25 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 disabled:opacity-50"
    >
      {Icon && <Icon className="h-4 w-4" />}
      {props.label}
    </button>
  );
}

/** A hairline with a word in it. */
export function OrRule(props: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-edge" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
        {props.label ?? "or"}
      </span>
      <span className="h-px flex-1 bg-edge" />
    </div>
  );
}

/**
 * The Terms box. Both sign-up forms gate submit on it — including the social
 * buttons — which is what makes `terms_accepted_ms` on the account truthful.
 */
export function TermsCheckbox(props: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-edge bg-panel-2/60 px-3.5 py-[clamp(0.5rem,1.6vh,0.875rem)] text-[13px] leading-snug">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink/25 bg-panel transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40"
      >
        <Check
          className={`h-3.5 w-3.5 text-accent-ink transition-opacity ${
            props.checked ? "opacity-100" : "opacity-0"
          }`}
        />
      </span>
      <span className="text-ink/85">
        I agree to the{" "}
        <Link to="/terms" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
          Terms and Conditions
        </Link>{" "}
        and the{" "}
        <Link to="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-accent hover:underline">
          Privacy Policy
        </Link>
        , and that usage runs on the account I connect.
      </span>
    </label>
  );
}

/**
 * The six-digit code Clerk mails. One wide monospaced field rather than six
 * boxes: it takes a paste, an autofill and a screen reader without any of the
 * focus juggling six inputs need.
 */
export function CodeField(props: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { value, onComplete } = props;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (value.length === 6) onComplete?.();
    // Firing on length alone means a paste submits once, not once per keystroke.
  }, [value, onComplete]);

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => props.onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      disabled={props.disabled}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      placeholder="000000"
      aria-label="Verification code"
      className="mono w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-center text-xl tracking-[0.5em] text-ink placeholder:text-ink-dim/40 transition duration-300 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10 disabled:opacity-50"
    />
  );
}
