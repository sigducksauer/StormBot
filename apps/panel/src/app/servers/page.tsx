"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { api } from "@/lib/api/client";

interface Server {
  id: string; discord_id: number; name: string;
  icon: string | null; plan: string; onboarding_done: boolean;
  member_count?: number;
}

const PLAN_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  simples:    { label: "Simples",     color: "#64748b", bg: "rgba(100,116,139,.12)" },
  standard:   { label: "Standard",   color: "#7c3aed", bg: "rgba(124,58,237,.12)"  },
  premium:    { label: "Premium",    color: "#a855f7", bg: "rgba(168,85,247,.12)"  },
  enterprise: { label: "Enterprise", color: "#f59e0b", bg: "rgba(245,158,11,.12)"  },
};

function ServerIcon({ server }: { server: Server }) {
  const [failed, setFailed] = useState(false);
  if (server.icon && !failed) {
    return (
      <img
        src={`https://cdn.discordapp.com/icons/${server.discord_id}/${server.icon}.png`}
        alt={server.name}
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span style={{ fontSize: 18, fontWeight: 800, color: "#c8bfe8", fontFamily: "Syne,sans-serif" }}>
      {server.name[0]?.toUpperCase() || "?"}
    </span>
  );
}

export default function ServersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/"); return; }

    api.get<Server[]>("/servers")
      .then(d => setServers(Array.isArray(d) ? d : []))
      .catch(() => setError("Não foi possível carregar seus servidores."))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  function enter(s: Server) {
    if (!s.onboarding_done) router.push(`/onboarding?server_id=${s.id}`);
    else router.push(`/dashboard/${s.id}`);
  }

  const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--bg)",
      backgroundImage: "radial-gradient(circle, rgba(120,50,255,0.12) 1px, transparent 1px)",
      backgroundSize: "26px 26px",
      padding: "24px 16px",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ maxWidth: 780, width: "100%" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg,#7c3aed,#a855f7)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 22, color: "#fff",
            boxShadow: "0 8px 24px rgba(124,58,237,.4)", marginBottom: 16,
          }}>S</div>

          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f0ecfc", fontFamily: "Syne,sans-serif" }}>
            Olá, {user?.username}! 👋
          </h1>
          <p style={{ fontSize: 14, color: "#8b7aac", marginTop: 6 }}>
            Selecione o servidor que deseja gerenciar.
          </p>
        </div>

        {/* Erro */}
        {error && (
          <div style={{
            padding: "12px 16px", borderRadius: 10, marginBottom: 20,
            background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)",
            color: "#ef4444", fontSize: 14, textAlign: "center",
          }}>
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14 }} />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div className="vcard" style={{ textAlign: "center", padding: "48px 28px" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>◈</div>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#c8bfe8", marginBottom: 8 }}>
              Nenhum servidor encontrado
            </p>
            <p style={{ fontSize: 13, color: "#8b7aac", marginBottom: 24, lineHeight: 1.7, maxWidth: 340, margin: "0 auto 24px" }}>
              Você precisa ser dono de um servidor e ter o Storm Bots adicionado para continuar.
            </p>
            <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
              <button className="vbp" style={{ padding: "12px 28px", fontSize: 15 }}>
                + Adicionar Storm Bots
              </button>
            </a>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
              gap: 14,
              marginBottom: 20,
            }}>
              {servers.map(s => {
                const plan = PLAN_STYLES[s.plan] || PLAN_STYLES.simples;
                return (
                  <button
                    key={s.id}
                    onClick={() => enter(s)}
                    style={{
                      all: "unset",
                      display: "block",
                      background: "rgba(15,12,26,0.92)",
                      border: "1px solid rgba(120,50,255,.14)",
                      borderRadius: 14,
                      padding: "20px 20px",
                      cursor: "pointer",
                      transition: "all .2s",
                      textAlign: "left",
                      width: "100%",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.borderColor = "rgba(168,85,247,.35)";
                      e.currentTarget.style.boxShadow = "0 8px 32px rgba(124,58,237,.15)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.borderColor = "rgba(120,50,255,.14)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                        background: "rgba(124,58,237,.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        overflow: "hidden",
                      }}>
                        <ServerIcon server={s} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 14, fontWeight: 700, color: "#f0ecfc",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{s.name}</p>
                        <span className="badge" style={{ background: plan.bg, color: plan.color, marginTop: 3, fontSize: "0.7rem" }}>
                          {plan.label}
                        </span>
                      </div>
                    </div>

                    {!s.onboarding_done && (
                      <div style={{
                        padding: "6px 10px", borderRadius: 8,
                        background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)",
                        fontSize: 12, color: "#f59e0b", marginBottom: 10,
                      }}>
                        ⚡ Configuração pendente
                      </div>
                    )}

                    {s.member_count && (
                      <p style={{ fontSize: 12, color: "#4a3d6e", marginTop: 4 }}>
                        👥 {s.member_count.toLocaleString("pt-BR")} membros
                      </p>
                    )}

                    <p style={{ fontSize: 12, color: "#8b7aac", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      Gerenciar <span style={{ fontSize: 10 }}>→</span>
                    </p>
                  </button>
                );
              })}
            </div>

            <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a href={INVITE_URL} target="_blank" rel="noopener noreferrer">
                <button className="vbg" style={{ padding: "9px 22px", fontSize: 13 }}>
                  + Adicionar servidor
                </button>
              </a>
              <button
                className="vbg"
                style={{ padding: "9px 22px", fontSize: 13 }}
                onClick={() => window.location.reload()}
              >
                ↻ Atualizar
              </button>
            </div>
          </>
        )}

        {/* Rodapé */}
        <p style={{ textAlign: "center", fontSize: 12, color: "#4a3d6e", marginTop: 32 }}>
          Storm Bots · <a href="https://stormbots.com.br" style={{ color: "#4a3d6e" }} target="_blank">stormbots.com.br</a>
        </p>
      </div>
    </div>
  );
}
