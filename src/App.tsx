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
import { Link, Navigate, Route, Routes, useLocation, useMatch, useNavigate, useParams } from "react-router-dom";
import { AuthenticateWithRedirectCallback, useAuth as useClerkAuth } from "@clerk/react";
import { Menu, SquarePen } from "lucide-react";
import { get, onAuthRequired, post, setTokenSource } from "./lib/api";
import { AFTER_AUTH_PATH, CLERK_ENABLED, SSO_CALLBACK_PATH, clerkFrontendApi } from "./lib/clerk";
import { useClerkReady } from "./pages/auth/useClerkReady";
import type { ChatSummary } from "./lib/chat";
import { Wordmark } from "./components/brand";
import { TilesBackdrop } from "./components/marketing/Backdrop";
import { ThemeToggle } from "./components/marketing/ThemeToggle";
import SearchDialog from "./components/SearchDialog";
import Sidebar from "./components/Sidebar";
import { Spinner } from "./components/ui";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Docs from "./pages/Docs";
import Keys from "./pages/Keys";

// Marketing and auth pages carry framer-motion, Lenis and the hero art — keep
// them out of the signed-in app's bundle.
const Landing = lazy(() => import("./pages/Landing"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));

export interface Me {
  user: {
    id: string;
    email: string;
    displayName: string;
    createdMs: number;
    termsAcceptedMs?: number | null;
  };
  config: {
    allowRegistration: boolean;
    redirectMode: "paste" | "callback";
    publicUrl: string;
    termsVersion?: string;
    /** Which engine the backend is running — see lib/clerk.ts. */
    authProvider?: "clerk" | "password";
  };
}

// --- auth ------------------------------------------------------------------------

interface AuthState {
  me: Me | null;
  setMe: (me: Me | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({ me: null, setMe: () => {}, signOut: async () => {} });
export const useAuth = () => useContext(AuthContext);

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
      navigate("/login", { replace: true });
    });
  }, [navigate, setMe]);

  const signOut = useCallback(async () => {
    try {
      await post("/api/auth/logout");
    } finally {
      setMe(null);
      navigate("/", { replace: true });
    }
  }, [navigate, setMe]);

  if (me === undefined) return <PageFallback />;
  return <AuthedRoutes me={me} setMe={setMe} signOut={signOut} />;
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
      return;
    }
    let cancelled = false;
    get<Me>("/api/auth/me")
      .then((value) => {
        if (cancelled) return;
        if (value.config.authProvider !== "clerk") {
          console.error(
            "This build signs in with Clerk but the backend does not — set OHSHI_CLERK_PUBLISHABLE_KEY on the API.",
          );
        }
        setMe(value);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, setMe]);

  useEffect(
    () =>
      onAuthRequired(() => {
        setMe(null);
        navigate("/login", { replace: true });
      }),
    [navigate, setMe],
  );

  const signOut = useCallback(async () => {
    try {
      await clerkSignOut();
    } finally {
      setMe(null);
      navigate("/", { replace: true });
    }
  }, [clerkSignOut, navigate, setMe]);

  // Deliberately no early spinner here. Public pages render at once and only
  // /app waits (inside AuthedRoutes) for `me` to be known — a marketing page
  // must never depend on an auth vendor's script arriving.
  // `me` stays undefined until Clerk has loaded and /api/auth/me answered,
  // or until the watchdog above decides Clerk is not coming.
  return <AuthedRoutes me={me} setMe={setMe} signOut={signOut} />;
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
}) {
  const { me, setMe, signOut } = props;
  const lazyPage = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;

  return (
    <AuthContext.Provider value={{ me: me ?? null, setMe, signOut }}>
      <Routes>
        <Route path="/" element={lazyPage(<Landing />)} />
        <Route path="/terms" element={lazyPage(<Terms />)} />
        <Route path="/privacy" element={lazyPage(<Privacy />)} />
        <Route path="/login" element={me ? <Navigate to="/app" replace /> : lazyPage(<Login />)} />
        <Route path="/signup" element={me ? <Navigate to="/app" replace /> : lazyPage(<Signup />)} />
        {/* Where Clerk drops the browser back after a social sign-in round
            trip; it finishes the handshake and then routes on. */}
        {CLERK_ENABLED && (
          <Route
            path={SSO_CALLBACK_PATH}
            element={
              <>
                <PageFallback />
                <AuthenticateWithRedirectCallback
                  signInFallbackRedirectUrl={AFTER_AUTH_PATH}
                  signUpFallbackRedirectUrl={AFTER_AUTH_PATH}
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
                      path="accounts"
                      element={
                        <Page>
                          <Dashboard />
                        </Page>
                      }
                    />
                    <Route
                      path="keys"
                      element={
                        <Page>
                          <Keys />
                        </Page>
                      }
                    />
                    <Route
                      path="docs"
                      element={
                        <Page>
                          <Docs />
                        </Page>
                      }
                    />
                    <Route path="*" element={<Navigate to="/app" replace />} />
                  </Routes>
                </Shell>
              </ChatListProvider>
            ) : (
              <Navigate to="/login" replace />
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
  const { me, signOut } = useAuth();
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

  return (
    <div className="app-shell relative flex h-screen overflow-hidden bg-surface">
      <TilesBackdrop />
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onSearch={() => {
          setMobileOpen(false);
          setSearchOpen(true);
        }}
        onRename={rename}
        onDelete={onDelete}
        user={{ email: me?.user.email ?? "", displayName: me?.user.displayName ?? "" }}
        onSignOut={() => void signOut()}
      />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-edge/70 bg-rail/60 px-3 py-2 backdrop-blur-2xl md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-full p-2 text-ink-dim transition-colors hover:bg-ink/10 hover:text-ink"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/app" aria-label="Ohshi">
            <Wordmark className="h-8" />
          </Link>
          <div className="flex items-center gap-0.5">
            <ThemeToggle compact />
            <Link
              to="/app"
              className="rounded-full p-2 text-ink-dim transition-colors hover:bg-ink/10 hover:text-ink"
              aria-label="New chat"
            >
              <SquarePen className="h-5 w-5" />
            </Link>
          </div>
        </header>
        <main key={routeKey} className="route-fade flex min-h-0 flex-1 flex-col">
          {props.children}
        </main>
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

function Page(props: { children: ReactNode }) {
  return (
    <div id="main-content" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">{props.children}</div>
    </div>
  );
}
