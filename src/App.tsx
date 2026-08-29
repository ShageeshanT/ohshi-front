import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate } from "react-router-dom";
import { Menu, SquarePen } from "lucide-react";
import { get, onAuthRequired, post } from "./lib/api";
import type { ChatSummary } from "./lib/chat";
import { Brand } from "./components/brand";
import SearchDialog from "./components/SearchDialog";
import Sidebar from "./components/Sidebar";
import { Spinner } from "./components/ui";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Docs from "./pages/Docs";
import Keys from "./pages/Keys";
import Login from "./pages/Login";
import { Link } from "react-router-dom";

export interface Me {
  user: { id: string; email: string; displayName: string; createdMs: number };
  config: { allowRegistration: boolean; redirectMode: "paste" | "callback"; publicUrl: string };
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

export default function App() {
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
      navigate("/login", { replace: true });
    }
  }, [navigate, setMe]);

  if (me === undefined) {
    return (
      <div className="dotted-canvas flex h-screen items-center justify-center text-ink-dim">
        <Spinner />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ me, setMe, signOut }}>
      <Routes>
        <Route path="/login" element={me ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/*"
          element={
            me ? (
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
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Shell>
              </ChatListProvider>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
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
  const match = useMatch("/c/:chatId");
  const activeChatId = match?.params.chatId ?? null;
  // Chat routes keep their own scroll/stream state — animating on every message
  // would restart it, so only non-chat routes get the entrance transition.
  const routeKey = location.pathname.startsWith("/c/") ? "chat" : location.pathname;
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
    if (id === activeChatId) navigate("/");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-edge bg-panel px-3 py-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-full p-2 text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Brand dark />
          <Link
            to="/"
            className="rounded-full p-2 text-ink-dim transition-colors hover:bg-panel-2 hover:text-ink"
            aria-label="New chat"
          >
            <SquarePen className="h-5 w-5" />
          </Link>
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
    <div id="main-content" className="dotted-canvas min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">{props.children}</div>
    </div>
  );
}
