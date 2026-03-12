"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Affiliate {
  id: string; discord_id: number; username: string; referral_code: string;
  referral_link?: string; commission_rate: number; total_referrals: number;
  total_revenue: number; total_commission: number; pending_commission: number;
  paid_commission: number; is_active: boolean; pix_key: string | null; created_at: string;
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  const isOk = msg.startsWith("✅");
  return (
    <div className={`toast ${isOk ? "toast-success" : "toast-error"}`}>{msg}</div>
  );
}

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      title="Copiar link"
      style={{
        fontSize: 11, padding: "3px 10px", borderRadius: 7, cursor: "pointer",
        border: `1px solid ${copied ? "rgba(16,185,129,.3)" : "rgba(120,50,255,.25)"}`,
        background: copied ? "rgba(16,185,129,.08)" : "rgba(120,50,255,.08)",
        color: copied ? "#10b981" : "#a855f7", fontWeight: 600, transition: "all .2s",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "✓ Copiado!" : `📋 ${label}`}
    </button>
  );
}

export default function AfiliadosPage() {
  const { serverId } = useParams() as { serverId: string };
  const [affiliates,  setAffiliates]  = useState<Affiliate[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [open,        setOpen]        = useState(false);
  const [payoutOpen,  setPayoutOpen]  = useState<Affiliate | null>(null);
  const [payoutAmt,   setPayoutAmt]   = useState("");
  const [form,        setForm]        = useState({ discord_id: "", username: "", commission_rate: "5", pix_key: "" });
  const [saving,      setSaving]      = useState(false);
  const [toastMsg,    setToastMsg]    = useState("");

  const toast = useCallback((m: string, err = false) => {
    setToastMsg((err ? "❌ " : "✅ ") + m);
    setTimeout(() => setToastMsg(""), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAffiliates(await api.get<Affiliate[]>("/affiliates", serverId)); }
    catch { setAffiliates([]); }
    finally { setLoading(false); }
  }, [serverId]);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/affiliates", {
        ...form,
        discord_id: Number(form.discord_id),
        commission_rate: Number(form.commission_rate),
      }, serverId);
      toast("Afiliado criado com sucesso!");
      setOpen(false);
      setForm({ discord_id: "", username: "", commission_rate: "5", pix_key: "" });
      load();
    } catch (err: any) {
      toast(err?.message || "Erro ao criar afiliado", true);
    } finally {
      setSaving(false);
    }
  }

  async function doPayout() {
    if (!payoutOpen) return;
    const amt = parseFloat(payoutAmt);
    if (isNaN(amt) || amt <= 0) { toast("Valor inválido", true); return; }
    try {
      await api.post(`/affiliates/${payoutOpen.id}/payout`, { amount: amt }, serverId);
      toast("Saque registrado!");
      setPayoutOpen(null);
      setPayoutAmt("");
      load();
    } catch (err: any) {
      toast(err?.message || "Erro ao registrar saque", true);
    }
  }

  async function toggleAffiliate(a: Affiliate) {
    try {
      await api.patch(`/affiliates/${a.id}`, { is_active: !a.is_active }, serverId);
      toast(a.is_active ? "Afiliado pausado" : "Afiliado ativado");
      load();
    } catch {
      toast("Erro ao atualizar", true);
    }
  }

  function getReferralLink(a: Affiliate) {
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(":8000", ":3000") || "";
    return a.referral_link || `${base}/r/${a.referral_code}`;
  }

  const totalCommission = affiliates.reduce((s, a) => s + a.total_commission, 0);
  const totalPending    = affiliates.reduce((s, a) => s + a.pending_commission, 0);
  const totalRevenue    = affiliates.reduce((s, a) => s + a.total_revenue, 0);

  return (
    <div className="fu">
      <Toast msg={toastMsg} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--s1)" }}>◆ Afiliados</h1>
          <p style={{ fontSize: 13, color: "var(--s3)", marginTop: 3 }}>
            Programa de indicação com comissões automáticas
          </p>
        </div>
        <button className="vbp" onClick={() => setOpen(true)}>+ Novo Afiliado</button>
      </div>

      {/* Stats */}
      <div className="grid-4col" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { l: "Afiliados Ativos",    v: String(affiliates.filter(a => a.is_active).length), c: "#a855f7" },
          { l: "Receita via Links",   v: `R$ ${totalRevenue.toFixed(2)}`,                    c: "#10b981" },
          { l: "Comissão Total",      v: `R$ ${totalCommission.toFixed(2)}`,                 c: "#3b82f6" },
          { l: "Aguardando Saque",    v: `R$ ${totalPending.toFixed(2)}`,                    c: "#f59e0b" },
        ].map(s => (
          <div key={s.l} className="vcard" style={{ padding: "18px 20px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--s4)", marginBottom: 6 }}>{s.l}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: s.c }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : affiliates.length === 0 ? (
        <div className="vcard" style={{ textAlign: "center", padding: "64px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>◇</div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--s2)", marginBottom: 8 }}>Nenhum afiliado cadastrado</p>
          <p style={{ fontSize: 13, color: "var(--s4)", marginBottom: 24 }}>
            Adicione afiliados e gere links de indicação com comissão automática.
          </p>
          <button className="vbp" onClick={() => setOpen(true)}>+ Adicionar primeiro afiliado</button>
        </div>
      ) : (
        <div className="vcard" style={{ overflow: "hidden" }}>
          {/* Mobile: cards */}
          <div style={{ display: "none" }} className="mobile-affiliate-cards">
            {affiliates.map(a => (
              <div key={a.id} style={{ padding: "16px 18px", borderBottom: "1px solid rgba(120,50,255,.08)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--s1)" }}>{a.username}</p>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 100, fontWeight: 600,
                      background: a.is_active ? "rgba(16,185,129,.1)" : "rgba(71,85,105,.1)",
                      color: a.is_active ? "#10b981" : "var(--s4)",
                    }}>{a.is_active ? "Ativo" : "Inativo"}</span>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#10b981" }}>R$ {a.total_revenue.toFixed(2)}</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <code style={{ fontSize: 12, color: "#a855f7", fontWeight: 700, background: "rgba(168,85,247,.1)", padding: "3px 8px", borderRadius: 6 }}>
                    {a.referral_code}
                  </code>
                  <CopyButton text={getReferralLink(a)} label="Link" />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {a.pending_commission > 0 && (
                    <button onClick={() => { setPayoutOpen(a); setPayoutAmt(a.pending_commission.toFixed(2)); }}
                      style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(16,185,129,.3)", background: "rgba(16,185,129,.08)", color: "#10b981", cursor: "pointer", fontWeight: 600 }}>
                      Sacar R$ {a.pending_commission.toFixed(2)}
                    </button>
                  )}
                  <button onClick={() => toggleAffiliate(a)}
                    style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--s4)", cursor: "pointer" }}>
                    {a.is_active ? "Pausar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hide-mobile" style={{ overflowX: "auto" }}>
            <table className="vtable">
              <thead>
                <tr>
                  {["Afiliado", "Código / Link", "Comissão", "Indicações", "Receita", "Pendente", "Pago", "Status", "Ações"].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {affiliates.map(a => (
                  <tr key={a.id}>
                    <td>
                      <p style={{ fontWeight: 600, color: "var(--s1)", fontSize: 13 }}>{a.username}</p>
                      {a.pix_key && <p style={{ fontSize: 11, color: "var(--s4)" }}>Pix: {a.pix_key}</p>}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <code style={{ fontSize: 12, color: "#a855f7", fontWeight: 700 }}>{a.referral_code}</code>
                        <CopyButton text={getReferralLink(a)} label="Link" />
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--s1)" }}>{a.commission_rate}%</td>
                    <td>{a.total_referrals}</td>
                    <td style={{ fontWeight: 700, color: "#10b981" }}>R$ {a.total_revenue.toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: "#f59e0b" }}>R$ {a.pending_commission.toFixed(2)}</td>
                    <td style={{ color: "var(--s4)" }}>R$ {a.paid_commission.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${a.is_active ? "badge-success" : ""}`}
                        style={!a.is_active ? { background: "rgba(71,85,105,.1)", color: "var(--s4)" } : {}}>
                        {a.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {a.pending_commission > 0 && (
                          <button onClick={() => { setPayoutOpen(a); setPayoutAmt(a.pending_commission.toFixed(2)); }}
                            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "1px solid rgba(16,185,129,.3)", background: "rgba(16,185,129,.08)", color: "#10b981", cursor: "pointer" }}>
                            Sacar
                          </button>
                        )}
                        <button onClick={() => toggleAffiliate(a)}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--s4)", cursor: "pointer" }}>
                          {a.is_active ? "Pausar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: novo afiliado */}
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--s1)" }}>Novo Afiliado</h2>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--s4)", fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <form onSubmit={create} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { l: "Discord ID *",        k: "discord_id",     t: "text",   p: "123456789012345678" },
                { l: "Nome de usuário *",   k: "username",       t: "text",   p: "@usuario" },
                { l: "Taxa de comissão (%)", k: "commission_rate", t: "number", p: "5" },
                { l: "Chave Pix para saques", k: "pix_key",      t: "text",   p: "email@exemplo.com" },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--s4)", display: "block", marginBottom: 5 }}>{f.l}</label>
                  <input
                    type={f.t} className="vi"
                    value={(form as any)[f.k]}
                    onChange={e => setForm(fm => ({ ...fm, [f.k]: e.target.value }))}
                    placeholder={f.p}
                    required={f.l.endsWith("*")}
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" className="vbg" style={{ flex: 1, justifyContent: "center" }} onClick={() => setOpen(false)}>Cancelar</button>
                <button type="submit" className="vbp" style={{ flex: 1, justifyContent: "center" }} disabled={saving}>
                  {saving ? "Criando..." : "Criar Afiliado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: saque */}
      {payoutOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, width: "100%", maxWidth: 380 }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--s1)" }}>Registrar Saque</h2>
              <p style={{ fontSize: 13, color: "var(--s3)", marginTop: 4 }}>
                Afiliado: <strong style={{ color: "var(--s1)" }}>{payoutOpen.username}</strong>
                {payoutOpen.pix_key && <> · Pix: <code style={{ color: "#a855f7" }}>{payoutOpen.pix_key}</code></>}
              </p>
            </div>
            <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--s4)", display: "block", marginBottom: 5 }}>
                  Valor (máx. R$ {payoutOpen.pending_commission.toFixed(2)})
                </label>
                <input type="number" className="vi" value={payoutAmt}
                  onChange={e => setPayoutAmt(e.target.value)}
                  min="0.01" max={payoutOpen.pending_commission} step="0.01" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="vbg" style={{ flex: 1, justifyContent: "center" }} onClick={() => setPayoutOpen(null)}>Cancelar</button>
                <button className="vbp" style={{ flex: 1, justifyContent: "center" }} onClick={doPayout}>Confirmar Saque</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-affiliate-cards { display: block !important; }
        }
      `}</style>
    </div>
  );
}
