import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fade-and-rise once the element scrolls into view. Pure CSS transition
 *  driven by an IntersectionObserver — nothing runs per frame. */
export function Reveal(props: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${seen ? "is-visible" : ""} ${props.className ?? ""}`}
      style={props.delay ? { transitionDelay: `${props.delay}ms` } : undefined}
    >
      {props.children}
    </div>
  );
}
