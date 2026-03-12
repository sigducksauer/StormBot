"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

interface AuthUser {
  id: string;
  discord_id: number;
  username: string;
  avatar: string | null;
  email?: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, token: null, logout: () => {}, loading: true,
  refreshUser: async () => {},
});

export function useAuth() { return useContext(AuthContext); }

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Tempo máximo de sessão sem refresh: 23h
const SESSION_TTL = 23 * 60 * 60 * 1000;

function isTokenExpiringSoon(token: string): boolean {
  try {
    const [, payload] = token.split(".");
    const { exp } = JSON.parse(atob(payload));
    // Menos de 30min para expirar
    return exp * 1000 - Date.now() < 30 * 60 * 1000;
  } catch { return false; }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname  = usePathname();
  const router    = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchUser = useCallback(async (t: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setUser(data);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("sb_token");
    localStorage.removeItem("sb_token_ts");
    setUser(null);
    setToken(null);
    clearTimeout(refreshTimer.current);
    window.location.href = "/";
  }, []);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem("sb_token");
    if (!t) return;
    const ok = await fetchUser(t);
    if (!ok) logout();
  }, [fetchUser, logout]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Captura token da URL (vindo do OAuth) — remove imediatamente da URL
    const params   = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      localStorage.setItem("sb_token", urlToken);
      localStorage.setItem("sb_token_ts", Date.now().toString());
      // Remove token da URL sem reload (segurança — não fica no histórico)
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }

    const stored   = urlToken ?? localStorage.getItem("sb_token");
    const storedTs = parseInt(localStorage.getItem("sb_token_ts") || "0");

    if (!stored) { setLoading(false); return; }

    // Sessão expirada por tempo
    if (storedTs && Date.now() - storedTs > SESSION_TTL) {
      logout();
      return;
    }

    // Avisa se token está expirando
    if (isTokenExpiringSoon(stored)) {
      console.warn("[Auth] Token expirando em breve.");
    }

    setToken(stored);

    fetchUser(stored).then(ok => {
      if (!ok) logout();
    }).finally(() => setLoading(false));

    // Refresh de user a cada 10 minutos
    refreshTimer.current = setInterval(refreshUser, 10 * 60 * 1000);
    return () => clearInterval(refreshTimer.current);
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#07050f",
        backgroundImage: "radial-gradient(circle, rgba(120,50,255,0.14) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "2px solid rgba(120,50,255,.25)", borderTopColor: "#a855f7",
            margin: "0 auto 16px",
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ color: "#4a3d6e", fontSize: 14, fontFamily: "DM Sans,sans-serif" }}>
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
