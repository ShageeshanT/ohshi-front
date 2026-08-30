import { ClerkProvider } from "@clerk/react";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { CLERK_ENABLED, CLERK_PUBLISHABLE_KEY } from "./lib/clerk";
import { ThemeProvider } from "./lib/theme";
import "./index.css";

/**
 * Clerk wraps the app only when a publishable key was built in. `CLERK_ENABLED`
 * is a build-time constant, so this branch is decided once at startup and the
 * tree below it never changes shape — no hook-order surprises.
 */
function WithClerk(props: { children: ReactNode }) {
  if (!CLERK_ENABLED) return props.children;
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      {props.children}
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <WithClerk>
          <App />
        </WithClerk>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
