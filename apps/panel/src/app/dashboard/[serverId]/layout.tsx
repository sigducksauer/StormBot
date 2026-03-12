"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { api } from "@/lib/api/client";

interface ServerInfo { name: string; plan: string; icon: string | null; discord_id: number; }

const NAV_GROUPS = [
  {
    label: "Visão Geral",
    items: [
      { href: "",            label: "Dashboard",  icon: "▦" },
      { href: "/clientes",   label: "Clientes",   icon: "◎" },
      { href: "/tickets",    label: "Tickets",    icon: "◉" },
    ],
  },
  {
    label: "Vendas",
    items: [
      { href: "/produtos",   label: "Produtos",   icon: "◈" },
      { href: "/pedidos",    label: "Pedidos",    icon: "◇" },
      { href: "/cupons",     label: "Cupons",     icon: "⬡" },
      { href: "/afiliados",  label: "Afiliados",  icon: "◆" },
      { href: "/avaliacoes", label: "Avaliações", icon: "◬" },
    ],
  },
  {
    label: "Automação",
    items: [
      { href: "/automacoes", label: "Automações", icon: "⬢" },
      { href: "/embeds",     label: "Embeds",     icon: "◎" },
      { href: "/webhooks",   label: "Webhooks",   icon: "◉" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/pagamentos", label: "Pagamentos", icon: "◇" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { href: "/equipe",     label: "Equipe",     icon: "◈" },
      { href: "/api-keys",   label: "API Keys",   icon: "⬡" },
      { href: "/audit",      label: "Auditoria",  icon: "◬" },
      { href: "/config",     label: "Config",     icon: "▦" },
      { href: "/upgrade",    label: "Planos",     icon: "◆" },
    ],
  },
];

const PLAN_COLORS: Record<string, string> = {
  simples: "#64748b", standard: "#7c3aed", premium: "#a855f7", enterprise: "#f59e0b",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { serverId } = useParams() as { serverId: string };
  const pathname     = usePathname();
  const router       = useRouter();
  const { user, logout } = useAuth();

  const base = `/dashboard/${serverId}`;
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [serverInfo,  setServerInfo]  = useState<ServerInfo | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fecha sidebar mobile ao navegar
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Fecha ao clicar fora (mobile)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Detecta mobile — começa collapsed
  useEffect(() => {
    if (window.innerWidth < 768) setCollapsed(false);
  }, []);

  // Busca info do servidor para sidebar
  useEffect(() => {
    api.get<ServerInfo>(`/servers/${serverId}/info`, serverId)
      .then(setServerInfo).catch(() => {});
  }, [serverId]);

  function isActive(href: string) {
    const full = `${base}${href}`;
    return href === "" ? pathname === base : pathname.startsWith(full);
  }

  const planColor = PLAN_COLORS[serverInfo?.plan || "simples"] || PLAN_COLORS.simples;

  const SidebarContent = () => (
    <>
      {/* Logo row */}
      <div style={{
        padding: "16px 12px 14px",
        borderBottom: "1px solid rgba(120,50,255,.12)",
        display: "flex", alignItems: "center", gap: 9, flexShrink: 0,
      }}>
        {serverInfo?.icon ? (
          <img
            src={`https://cdn.discordapp.com/icons/${serverInfo.discord_id}/${serverInfo.icon}.png`}
            alt=""
            style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, objectFit: "cover" }}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg,#7c3aed,#a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 13, color: "#fff",
            boxShadow: "0 4px 12px rgba(124,58,237,.4)",
          }}>S</div>
        )}

        {!collapsed && (
          <span style={{
            fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 13,
            color: "#f0ecfc", whiteSpace: "nowrap", flex: 1,
            overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {serverInfo?.name || "Storm Bots"}
          </span>
        )}

        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#4a3d6e", fontSize: 16, flexShrink: 0, padding: "2px 4px",
            lineHeight: 1, display: "flex", alignItems: "center",
          }}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1, padding: "10px 6px", overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 0,
      }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: collapsed ? 8 : 14 }}>
            {!collapsed && (
              <p style={{
                fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: ".1em", color: "#4a3d6e",
                padding: "0 8px", marginBottom: 3, marginTop: gi > 0 ? 4 : 0,
              }}>{group.label}</p>
            )}
            {collapsed && gi > 0 && (
              <div style={{ height: 1, background: "rgba(120,50,255,.12)", margin: "4px 8px 8px" }} />
            )}

            {group.items.map(item => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={`${base}${item.href}`}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: "flex", alignItems: "center",
                    gap: collapsed ? 0 : 9,
                    padding: collapsed ? "9px 0" : "8px 10px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: 8,
                    background: active ? "rgba(124,58,237,0.16)" : "transparent",
                    border: `1px solid ${active ? "rgba(124,58,237,0.32)" : "transparent"}`,
                    color: active ? "#c8bfe8" : "#4a3d6e",
                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                    transition: "all .15s", whiteSpace: "nowrap", marginBottom: 1,
                    minHeight: 36,
                  }}
                >
                  <span style={{ fontSize: 13, flexShrink: 0, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                  {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>}
                  {!collapsed && active && (
                    <div style={{
                      marginLeft: "auto", width: 4, height: 4,
                      borderRadius: "50%", background: "#a855f7", flexShrink: 0,
                    }} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Plano + User */}
      <div style={{
        padding: "8px 6px 10px",
        borderTop: "1px solid rgba(120,50,255,.12)",
        flexShrink: 0, display: "flex", flexDirection: "column", gap: 6,
      }}>
        {!collapsed && (
          <Link href={`${base}/upgrade`} style={{
            display: "block", padding: "10px 10px", borderRadius: 9,
            background: "rgba(124,58,237,0.07)",
            border: "1px solid rgba(124,58,237,0.16)", textDecoration: "none",
          }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#4a3d6e" }}>Plano atual</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: planColor, marginTop: 2, textTransform: "capitalize" }}>
              {serverInfo?.plan || "Simples"} ✦
            </p>
            <p style={{ fontSize: 11, color: "#4a3d6e", marginTop: 1 }}>Fazer upgrade →</p>
          </Link>
        )}

        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              background: "rgba(124,58,237,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#c8bfe8", overflow: "hidden",
            }}>
              {user.avatar
                ? <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : user.username[0].toUpperCase()
              }
            </div>
            {!collapsed && (
              <>
                <p style={{
                  fontSize: 12, fontWeight: 600, color: "#c8bfe8",
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {user.username}
                </p>
                <button
                  onClick={logout}
                  title="Sair"
                  aria-label="Sair da conta"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#4a3d6e", fontSize: 13, flexShrink: 0,
                    padding: "4px", borderRadius: 6,
                    transition: "color .15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#4a3d6e")}
                >↩</button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", background: "var(--bg)" }}>

      {/* ── Overlay mobile ── */}
      {mobileOpen && (
        <div
          ref={overlayRef}
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
            zIndex: 40, backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* ── Sidebar desktop ── */}
      <aside
        className="dash-sidebar"
        style={{
          width: collapsed ? 58 : 216,
          flexShrink: 0, display: "flex", flexDirection: "column",
          background: "rgba(8,5,18,0.97)",
          borderRight: "1px solid rgba(120,50,255,.12)",
          backdropFilter: "blur(16px)",
          transition: "width .22s cubic-bezier(.4,0,.2,1)",
          overflow: "hidden",
          position: "relative", zIndex: 10,
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Sidebar mobile (drawer) ── */}
      <aside
        className={`dash-sidebar${mobileOpen ? " open" : ""}`}
        style={{
          width: 240,
          display: "none", // CSS @media faz display:flex no mobile
          flexDirection: "column",
          background: "rgba(8,5,18,.99)",
          borderRight: "1px solid rgba(120,50,255,.12)",
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Main ── */}
      <main style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        backgroundImage: "radial-gradient(circle, rgba(120,50,255,0.08) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}>
        {/* Mobile topbar */}
        <div style={{
          display: "none", // mostrado via CSS no mobile
          padding: "12px 16px",
          borderBottom: "1px solid rgba(120,50,255,.1)",
          background: "rgba(8,5,18,.95)",
          alignItems: "center", gap: 12,
          position: "sticky", top: 0, zIndex: 30,
          backdropFilter: "blur(12px)",
        }} className="mobile-topbar">
          <button
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Abrir menu"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#c8bfe8", fontSize: 20, padding: "4px",
              display: "flex", alignItems: "center",
            }}
          >☰</button>
          <span style={{ fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 14, color: "#f0ecfc", flex: 1 }}>
            {serverInfo?.name || "Storm Bots"}
          </span>
          {user?.avatar && (
            <img src={user.avatar} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
          )}
        </div>

        <div className="dash-main" style={{ maxWidth: 1380, margin: "0 auto", padding: "28px 24px" }}>
          {children}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .dash-sidebar:not(.open) { display: none !important; }
          .dash-sidebar.open { display: flex !important; position: fixed !important; top:0; left:0; bottom:0; z-index:50; width:240px !important; }
          .mobile-topbar { display: flex !important; }
          .dash-main { padding: 16px !important; }
        }
        @media (min-width: 769px) {
          .dash-sidebar:first-of-type { display: flex !important; }
          .dash-sidebar:nth-of-type(2) { display: none !important; }
        }
      `}</style>
    </div>
  );
}
