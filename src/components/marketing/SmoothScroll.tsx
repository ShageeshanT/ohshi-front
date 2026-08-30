/** Lenis smooth scrolling for the marketing pages (the signed-in app has its
 *  own scroll panes and stays native). Same feel as the saasyland reference:
 *  lerp 0.1 with a 1.4s duration, wheel only — touch stays native so phones
 *  don't feel laggy. */

import { ReactLenis, useLenis } from "lenis/react";
import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

function ScrollRestore() {
  const lenis = useLenis();
  const { pathname } = useLocation();
  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
  }, [pathname, lenis]);
  return null;
}

export function SmoothScroll(props: { children: ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.4, smoothWheel: true, syncTouch: false }}>
      <ScrollRestore />
      {props.children}
    </ReactLenis>
  );
}
