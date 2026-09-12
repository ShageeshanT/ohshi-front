import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate, useParams } from "react-router-dom";
import { AuthenticateWithRedirectCallback, useAuth as useClerkAuth } from "@clerk/react";
import { ReactLenis } from "lenis/react";
import { get, onAuthRequired, post, setTokenSource } from "./lib/api";
import { CLERK_ENABLED, SSO_CALLBACK_PATH, afterAuthPath, clerkFrontendApi, peekAfterAuth } from "./lib/clerk";
import { useClerkReady } from "./pages/auth/useClerkReady";
import type { ChatSummary } from "./lib/chat";
import SearchDialog from "./components/SearchDialog";
import Sidebar from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { Spinner } from "./components/ui";
import Accounts from "./pages/Accounts";
import Billing from "./pages/Billing";
import Chat from "./pages/Chat";
import Connections from "./pages/Connections";
import Docs from "./pages/Docs";
import Keys from "./pages/Keys";
import Models from "./pages/Models";
import Overview from "./pages/Overview";
import Profile from "./pages/Profile";
import Usage from "./pages/Usage";

// Marketing and auth pages carry framer-motion, Lenis and the hero art — keep
// them out of the signed-in app's bundle.
const Landing = lazy(() => import("./pages/Landing"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminUser = lazy(() => import("./pages/AdminUser"));

export interface Me {
  user: {
    id: string;
    email: string;
    displayName: string;
    createdMs: number;
    termsAcceptedMs?: number | null;
    /** Ohshi's own plan (free / plus / pro), set by the billing backend only. */
    plan?: string;
    subscriptionStatus?: string | null;
    planRenewsMs?: number | null;
    /** Set while a chargeback is open (or was lost); checkout is refused. */
    billingFlag?: string | null;
    /** Listed in the backend's OHSHI_ADMIN_EMAILS: may open /app/admin. */
    isAdmin?: boolean;
  };
  config: {
    allowRegistration: boolean;
    redirectMode: "paste" | "callback";
    publicUrl: string;
    termsVersion?: string;
    /** Which engine the backend is running — see lib/clerk.ts. */
    authProvider?: "clerk" | "password";
    /** Whether the backend has a payment provider configured. */
    billingEnabled?: boolean;
    /** Which processor serves checkout: "polar" (merchant of record, has a portal), "paypal", or "". */
    billingProvider?: "polar" | "paypal" | "";
  };
}

// --- auth ------------------------------------------------------------------------

interface AuthState {
  me: Me | null;
  setMe: (me: Me | null) => void;
  signOut: () => Promise<void>;
  /** Set when Clerk vouched for the visitor but the API refused the session —
   *  the server's own words, shown by ClerkSessionGuard on the auth pages. */
  authError: string | null;
}

const AuthContext = createContext<AuthState>({
  me: null,
  setMe: () => {},
  signOut: async () => {},
  authError: null,
});
export const useAuth = () => useContext(AuthContext);

/** Only the backend's admin addresses see the admin pages; everyone else is
 *  sent back to the chat. The API refuses them regardless. */
function AdminOnly(props: { children: ReactNode }) {
  const { me } = useAuth();
  if (!me?.user.isAdmin) return <Navigate to="/app" replace />;
  return <>{props.children}</>;
}

// --- shell (sidebar + search, reachable from the top bar) ---------------------------

interface ShellState {
  openNav: () => void;
  openSearch: () => void;
}

const ShellContext = createContext<ShellState>({ openNav: () => {}, openSearch: () => {} });
export const useShell = () => useContext(ShellContext);

// --- chat list (sidebar history) ---------------------------------------------------

interface ChatListState {
  chats: ChatSummary[];
  refresh: () => Promise<void>;
  upsert: (chat: ChatSummary) => void;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const ChatListContext = createContext<ChatListState>({
  chats: [],
  refresh: async () => {},
  upsert: () => {},
  rename: async () => {},
  remove: async () => {},
});
export const useChatList = () => useContext(ChatListContext);

function ChatListProvider(props: { children: ReactNode }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);

  const refresh = useCallback(async () => {
    try {
      setChats((await get<{ chats: ChatSummary[] }>("/api/chats")).chats);
    } catch {
      /* the sidebar simply keeps its last list */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsert = useCallback((chat: ChatSummary) => {
    setChats((list) => {
      const next = list.filter((c) => c.id !== chat.id);
      next.push(chat);
      next.sort((a, b) => b.updatedMs - a.updatedMs);
      return next;
    });
  }, []);

  const rename = useCallback(async (id: string, title: string) => {
    const { chat } = await post<{ chat: ChatSummary }>(`/api/chats/${id}/rename`, { title });
    setChats((list) => list.map((c) => (c.id === id ? chat : c)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await post(`/api/chats/${id}/delete`);
    setChats((list) => list.filter((c) => c.id !== id));
  }, []);

  const value = useMemo(() => ({ chats, refresh, upsert, rename, remove }), [chats, refresh, upsert, rename, remove]);
  return <ChatListContext.Provider value={value}>{props.children}</ChatListContext.Provider>;
}

// --- app -------------------------------------------------------------------------------

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-ink-dim">
      <Spinner />
    </div>
  );
}

function LegacyChatRedirect() {
  const { chatId } = useParams<{ chatId: string }>();
  return <Navigate to={`/app/c/${chatId ?? ""}`} replace />;
}

/**
 * Which engine signs people in is a build-time constant, so the two gates are
 * separate components rather than branches inside one — the hook order can
 * never change between renders, and a build without Clerk never calls a Clerk
 * hook. Both end at the same `AuthedRoutes`.
 */
export default function App() {
  return CLERK_ENABLED ? <ClerkAuthGate /> : <SessionAuthGate />;
}

/** `/login?next=…` for the page the visitor was on, so an expired session
 *  returns them there; public pages just go to `/login`. */
function loginPathFor(location: { pathname: string; search: string }): string {
  const here = `${location.pathname}${location.search}`;
  return here.startsWith("/app") ? `/login?next=${encodeURIComponent(here)}` : "/login";
}

/** Run `fn`, once more after a short pause if it failed; true when it succeeded. */
async function tryTwice(fn: () => Promise<unknown>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await fn();
      return true;
    } catch {
      if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 600));
    }
  }
  return false;
}

/** Cookie sessions: ask the backend who we are, once, on load. */
function SessionAuthGate() {
  // undefined = still checking the session; null = signed out
  const [me, setMeState] = useState<Me | null | undefined>(undefined);
  const navigate = useNavigate();

  const setMe = useCallback((value: Me | null) => setMeState(value), []);

  useEffect(() => {
    get<Me>("/api/auth/me")
      .then(setMe)
      .catch(() => setMe(null));
    return onAuthRequired(() => {
      setMe(null);
      navigate(loginPathFor(window.location), { replace: true });
    });
  }, [navigate, setMe]);

  const signOut = useCallback(async () => {
    // The cookie has to really be gone: forgetting `me` alone would leave
    // the next person on this machine signed in. One retry, then keep the
    // session visible rather than pretend it ended.
    if (!(await tryTwice(() => post("/api/auth/logout")))) {
      console.error("sign-out did not reach the server — the session is still active");
      return;
    }
    setMe(null);
    navigate("/", { replace: true });
  }, [navigate, setMe]);

  if (me === undefined) return <PageFallback />;
  return <AuthedRoutes me={me} setMe={setMe} signOut={signOut} authError={null} />;
}

/**
 * Clerk holds the credential. Wait for the SDK, hand the API client a way to
 * mint bearer tokens, then fetch the profile and config that hang off the
 * account on our side — `me` is still ours, Clerk only says who it belongs to.
 */
function ClerkAuthGate() {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useClerkAuth();
  const { failed: clerkFailed } = useClerkReady();
  const [me, setMeState] = useState<Me | null | undefined>(undefined);
  const [authError, setAuthError] = useState<string | null>(null);
  const navigate = useNavigate();

  const setMe = useCallback((value: Me | null) => setMeState(value), []);

  // Clerk never arriving must not strand anyone on a spinner. Give up, treat
  // the visitor as signed out so the route guards resolve (the landing page
  // was never waiting; /app now redirects to /login, whose form explains),
  // and put the real cause in the console for whoever deployed.
  useEffect(() => {
    if (!clerkFailed) return;
    setMe(null);
    console.error(
      `Clerk did not load from ${clerkFrontendApi()}. Sign-in is unavailable until it does. ` +
        "Usually the CNAME for that host has not reached this resolver yet, or certificates " +
        "are not deployed in the Clerk dashboard. Check: curl -sI " +
        `${clerkFrontendApi()}/.well-known/jwks.json  (expect 200). See backend/docs/CLERK.md.`,
    );
  }, [clerkFailed, setMe]);

  // Every request asks for a token; Clerk hands back a cached one until it is
  // close to expiry, so this is not a round trip per call.
  useEffect(() => {
    setTokenSource(() => getToken());
    return () => setTokenSource(null);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setMe(null);
      setAuthError(null);
      return;
    }
    // Signed in at Clerk, profile still loading — keep `me` unknown so /app
    // waits instead of bouncing through /login and dropping `?next=`.
    setMeState(undefined);
    setAuthError(null);
    let cancelled = false;
    get<Me>("/api/auth/me")
      .then((value) => {
        if (cancelled) return;
        if (value.config.authProvider !== "clerk") {
          console.error(
            "This build signs in with Clerk but the backend does not — set OHSHI_CLERK_PUBLISHABLE_KEY on the API.",
          );
        }
        setAuthError(null);
        setMe(value);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Clerk vouched for the visitor but our API said no. Losing the
        // reason here is how "You're already signed in." dead ends happen —
        // keep the server's words for the auth pages to show.
        const reason = err instanceof Error ? err.message : String(err);
        console.error("The API refused the Clerk session:", reason);
        setAuthError(reason);
        setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, setMe]);

  useEffect(
    () =>
      onAuthRequired(() => {
        setMe(null);
        navigate(loginPathFor(window.location), { replace: true });
      }),
    [navigate, setMe],
  );

  const signOut = useCallback(async () => {
    if (!(await tryTwice(() => clerkSignOut()))) {
      console.error("sign-out did not reach Clerk — the session is still active");
      return;
    }
    setMe(null);
    navigate("/", { replace: true });
  }, [clerkSignOut, navigate, setMe]);

  // Deliberately no early spinner here. Public pages render at once and only
  // /app waits (inside AuthedRoutes) for `me` to be known — a marketing page
  // must never depend on an auth vendor's script arriving.
  // `me` stays undefined until Clerk has loaded and /api/auth/me answered,
  // or until the watchdog above decides Clerk is not coming.
  return <AuthedRoutes me={me} setMe={setMe} signOut={signOut} authError={authError} />;
}

/**
 * `me` is three-valued here: a user, null for signed out, undefined while that
 * is still unknown. Only /app has to wait for the answer; everything public
 * renders immediately and treats "unknown" as signed out, so the worst case
 * for a signed-in visitor is a nav that says "Sign In" for a moment.
 */
function AuthedRoutes(props: {
  me: Me | null | undefined;
  setMe: (me: Me | null) => void;
  signOut: () => Promise<void>;
  authError: string | null;
}) {
  const { me, setMe, signOut, authError } = props;
  const location = useLocation();
  const lazyPage = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;
  const loginPath = `/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  const afterAuth = afterAuthPath(new URLSearchParams(location.search).get("next"));
  const ssoAfterAuth = peekAfterAuth();

  return (
    <AuthContext.Provider value={{ me: me ?? null, setMe, signOut, authError }}>
      <Routes>
        <Route path="/" element={lazyPage(<Landing />)} />
        <Route path="/terms" element={lazyPage(<Terms />)} />
        <Route path="/privacy" element={lazyPage(<Privacy />)} />
        <Route path="/login" element={me ? <Navigate to={afterAuth} replace /> : lazyPage(<Login />)} />
        <Route path="/signup" element={me ? <Navigate to={afterAuth} replace /> : lazyPage(<Signup />)} />
        {/* Where Clerk drops the browser back after a social sign-in round
            trip; it finishes the handshake and then routes on. */}
        {CLERK_ENABLED && (
          <Route
            path={SSO_CALLBACK_PATH}
            element={
              <>
                <PageFallback />
                <AuthenticateWithRedirectCallback
                  signInFallbackRedirectUrl={ssoAfterAuth}
                  signUpFallbackRedirectUrl={ssoAfterAuth}
                />
              </>
            }
          />
        )}

        {/* Paths from before the landing page existed. */}
        <Route path="/c/:chatId" element={<LegacyChatRedirect />} />
        <Route path="/accounts" element={<Navigate to="/app/accounts" replace />} />
        <Route path="/keys" element={<Navigate to="/app/keys" replace />} />
        <Route path="/docs" element={<Navigate to="/app/docs" replace />} />

        <Route
          path="/app/*"
          element={
            me === undefined ? (
              <PageFallback />
            ) : me ? (
              <ChatListProvider>
                <Shell>
                  <Routes>
                    <Route index element={<Chat />} />
                    <Route path="c/:chatId" element={<Chat />} />
                    <Route
                      path="dashboard"
                      element={
                        <Page title="Overview">
                          <Overview />
                        </Page>
                      }
                    />
                    <Route
                      path="models"
                      element={
                        <Page title="Models">
                          <Models />
                        </Page>
                      }
                    />
                    <Route
                      path="usage"
                      element={
                        <Page title="Usage">
                          <Usage />
                        </Page>
                      }
                    />
                    <Route
                      path="connections"
                      element={
                        <Page title="Connections">
                          <Connections />
                        </Page>
                      }
                    />
                    <Route
                      path="accounts"
                      element={
                        <Page title="Connected accounts">
                          <Accounts />
                        </Page>
                      }
                    />
                    <Route
                      path="billing"
                      element={
                        <Page title="Plan and billing">
                          <Billing />
                        </Page>
                      }
                    />
                    <Route
                      path="profile"
                      element={
                        <Page title="Account">
                          <Profile />
                        </Page>
                      }
                    />
                    <Route
                      path="keys"
                      element={
                        <Page title="API keys">
                          <Keys />
                        </Page>
                      }
                    />
                    <Route
                      path="docs"
                      element={
                        <Page title="Docs">
                          <Docs />
                        </Page>
                      }
                    />
                    <Route
                      path="admin"
                      element={
                        <Page title="Admin">
                          <AdminOnly>{lazyPage(<Admin />)}</AdminOnly>
                        </Page>
                      }
                    />
                    <Route
                      path="admin/u/:userId"
                      element={
                        <Page title="Admin">
                          <AdminOnly>{lazyPage(<AdminUser />)}</AdminOnly>
                        </Page>
                      }
                    />
                    <Route path="*" element={<Navigate to="/app" replace />} />
                  </Routes>
                </Shell>
              </ChatListProvider>
            ) : (
              <Navigate to={loginPath} replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}

const COLLAPSED_KEY = "ohshi.sidebar.collapsed";

function Shell(props: { children: ReactNode }) {
  const { me } = useAuth();
  const { chats, rename, remove } = useChatList();
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch("/app/c/:chatId");
  const activeChatId = match?.params.chatId ?? null;
  // Chat routes keep their own scroll/stream state — animating on every message
  // would restart it, so only non-chat routes get the entrance transition.
  const routeKey = location.pathname.startsWith("/app/c/") ? "chat" : location.pathname;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, v ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !v;
    });
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDelete = async (id: string) => {
    await remove(id);
    if (id === activeChatId) navigate("/app");
  };

  const shell = useMemo<ShellState>(
    () => ({
      openNav: () => setMobileOpen(true),
      openSearch: () => {
        setMobileOpen(false);
        setSearchOpen(true);
      },
    }),
    [],
  );

  return (
    <ShellContext.Provider value={shell}>
      <div className="app-shell relative flex h-screen overflow-hidden bg-panel">
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onSearch={shell.openSearch}
          onRename={rename}
          onDelete={onDelete}
          user={{ email: me?.user.email ?? "", displayName: me?.user.displayName ?? "" }}
          plan={me?.user.plan}
          isAdmin={Boolean(me?.user.isAdmin)}
        />
        <main key={routeKey} className="route-fade flex min-h-0 min-w-0 flex-1 flex-col">
          {props.children}
        </main>
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </ShellContext.Provider>
  );
}

/** A scrolling page under the top bar. Chat draws its own bar and pane. */
function Page(props: { title: string; children: ReactNode }) {
  return (
    <>
      <Topbar title={props.title} />
      <ReactLenis
        id="main-content"
        className="app-smooth-scroll min-h-0 flex-1 overflow-y-auto"
        options={{ lerp: 0.1, duration: 1.4, smoothWheel: true, syncTouch: false }}
      >
        <div className="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 md:px-8 md:py-6">{props.children}</div>
      </ReactLenis>
    </>
  );
}
