"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

const PLANS = [
  {
    key:"simples", label:"Simples", price:0, fee:7, color:"#64748b", icon:"◎",
    period:"Grátis para sempre",
    features:["5 produtos", "Estoque manual", "Pix Manual", "1 embed", "Taxa de 7% por venda", "Suporte por Discord"],
    disabled:["Variantes de produto","Afiliados","Automações","Webhooks","API pública","Analytics avançado"],
  },
  {
    key:"standard", label:"Standard", price:29.90, fee:4, color:"#7c3aed", icon:"◈", highlight:true,
    period:"R$ 29,90/mês",
    features:["30 produtos", "Variantes ilimitadas", "MercadoPago + Pix", "Todos os embeds", "Cupons avançados", "Afiliados", "Automações básicas", "Webhooks (5)", "Analytics 30 dias", "Taxa de 4% por venda", "Suporte prioritário"],
    disabled:["API pública","White-label","Analytics personalizado"],
  },
  {
    key:"premium", label:"Premium", price:79.90, fee:2, color:"#a855f7", icon:"◇",
    period:"R$ 79,90/mês",
    features:["Produtos ilimitados", "Todos os gateways", "Automações avançadas", "Webhooks ilimitados", "API pública", "Analytics 1 ano", "Múltiplos admins", "Backups automáticos", "Taxa de 2% por venda", "Suporte dedicado"],
    disabled:["White-label","Domínio próprio"],
  },
  {
    key:"enterprise", label:"Enterprise", price:199.90, fee:1, color:"#f59e0b", icon:"◆",
    period:"R$ 199,90/mês",
    features:["Tudo do Premium", "White-label completo", "Domínio próprio", "SLA 99.9%", "Gerente dedicado", "Taxa de 1% por venda", "Onboarding assistido", "Integrações personalizadas"],
    disabled:[],
  },
];

export default function UpgradePage() {
  const { serverId } = useParams() as { serverId:string };
  const [billing, setBilling] = useState<"monthly"|"yearly">("monthly");
  const [loading, setLoading] = useState<string|null>(null);
  const [msg, setMsg] = useState("");

  async function upgrade(planKey: string) {
    setLoading(planKey);
    try {
      const d = await api.post<{checkout_url?:string}>(`/servers/${serverId}/upgrade`, { plan:planKey, billing }, serverId);
      if (d.checkout_url) window.open(d.checkout_url,"_blank");
      else { setMsg("✅ Plano atualizado!"); setTimeout(()=>setMsg(""),3000); }
    } catch(err:any) { setMsg("❌ "+(err?.message||"Erro")); setTimeout(()=>setMsg(""),4000); }
    finally { setLoading(null); }
  }

  const discount = 0.15; // 15% annual

  return (
    <div className="fu">
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <h1 style={{ fontSize:28, fontWeight:800, color:"var(--s1)", marginBottom:8 }}>Escolha seu plano</h1>
        <p style={{ fontSize:15, color:"var(--s3)" }}>Comece grátis, escale quando precisar</p>

        {/* Billing toggle */}
        <div style={{ display:"inline-flex", marginTop:20, background:"rgba(10,7,22,.8)", border:"1px solid var(--border)", borderRadius:12, padding:4, gap:4 }}>
          <button onClick={()=>setBilling("monthly")} style={{
            padding:"8px 24px", borderRadius:9, border:"none", cursor:"pointer", fontSize:14, fontWeight:600,
            background:billing==="monthly"?"rgba(124,58,237,.25)":"transparent",
            color:billing==="monthly"?"#c8bfe8":"var(--s4)",
          }}>Mensal</button>
          <button onClick={()=>setBilling("yearly")} style={{
            padding:"8px 24px", borderRadius:9, border:"none", cursor:"pointer", fontSize:14, fontWeight:600,
            background:billing==="yearly"?"rgba(124,58,237,.25)":"transparent",
            color:billing==="yearly"?"#c8bfe8":"var(--s4)",
            display:"flex", alignItems:"center", gap:8,
          }}>
            Anual
            <span style={{ fontSize:11, padding:"2px 7px", borderRadius:100, background:"rgba(34,197,94,.15)", color:"#22c55e", fontWeight:700 }}>-15%</span>
          </button>
        </div>
      </div>

      {msg && <div style={{ marginBottom:20, padding:"10px 16px", borderRadius:10, fontSize:14, textAlign:"center",
        background:msg.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
        border:`1px solid ${msg.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
        color:msg.startsWith("✅")?"#22c55e":"#ef4444"}}>{msg}</div>}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:16, alignItems:"start" }}>
        {PLANS.map(plan => {
          const price = billing==="yearly" ? plan.price*(1-discount)*12 : plan.price;
          return (
            <div key={plan.key} className="vcard" style={{
              padding:"26px 24px",
              borderColor: plan.highlight ? plan.color+"44" : "var(--border)",
              background: plan.highlight ? `rgba(124,58,237,0.08)` : undefined,
              position:"relative",
            }}>
              {plan.highlight && (
                <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", padding:"4px 16px", borderRadius:100, background:"linear-gradient(135deg,#7c3aed,#a855f7)", fontSize:11, fontWeight:700, color:"#fff", whiteSpace:"nowrap", boxShadow:"0 4px 12px rgba(124,58,237,.4)" }}>
                  Mais popular ✦
                </div>
              )}

              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                <span style={{ fontSize:22, color:plan.color }}>{plan.icon}</span>
                <h2 style={{ fontSize:17, fontWeight:700, color:"var(--s1)" }}>{plan.label}</h2>
              </div>

              <div style={{ marginBottom:20 }}>
                {plan.price===0 ? (
                  <p style={{ fontSize:28, fontWeight:800, color:plan.color }}>Grátis</p>
                ) : billing==="yearly" ? (
                  <div>
                    <p style={{ fontSize:26, fontWeight:800, color:plan.color }}>
                      R$ {(price/12).toFixed(2)}<span style={{ fontSize:14, fontWeight:500, color:"var(--s4)" }}>/mês</span>
                    </p>
                    <p style={{ fontSize:12, color:"#22c55e" }}>= R$ {price.toFixed(2)}/ano (economize {Math.round(plan.price*12*discount).toFixed(0)})</p>
                  </div>
                ) : (
                  <p style={{ fontSize:26, fontWeight:800, color:plan.color }}>
                    R$ {plan.price.toFixed(2)}<span style={{ fontSize:14, fontWeight:500, color:"var(--s4)" }}>/mês</span>
                  </p>
                )}
                <p style={{ fontSize:12, color:"var(--s4)", marginTop:4 }}>Taxa: <strong style={{ color:plan.color }}>{plan.fee}%</strong> por venda</p>
              </div>

              <div style={{ marginBottom:20, display:"flex", flexDirection:"column", gap:7 }}>
                {plan.features.map(f=>(
                  <div key={f} style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                    <span style={{ color:"#22c55e", flexShrink:0, fontSize:13, marginTop:1 }}>✓</span>
                    <span style={{ fontSize:13, color:"var(--s2)" }}>{f}</span>
                  </div>
                ))}
                {plan.disabled.map(f=>(
                  <div key={f} style={{ display:"flex", alignItems:"flex-start", gap:8, opacity:0.4 }}>
                    <span style={{ color:"var(--s4)", flexShrink:0, fontSize:13, marginTop:1 }}>✕</span>
                    <span style={{ fontSize:13, color:"var(--s4)" }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={()=>plan.price>0?upgrade(plan.key):null}
                disabled={plan.price===0||loading===plan.key}
                style={{
                  width:"100%", padding:"11px", borderRadius:10, border:"none", cursor:plan.price===0?"default":"pointer",
                  fontFamily:"DM Sans,sans-serif", fontWeight:700, fontSize:14,
                  background: plan.price===0 ? "rgba(255,255,255,.06)" : plan.highlight ? `linear-gradient(135deg,#7c3aed,#a855f7)` : `rgba(120,50,255,.15)`,
                  color: plan.price===0 ? "var(--s4)" : "#fff",
                  boxShadow: plan.highlight&&plan.price>0 ? "0 4px 20px rgba(124,58,237,.35)" : "none",
                  opacity:loading&&loading!==plan.key?0.6:1,
                  transition:"all .2s",
                }}
              >
                {plan.price===0 ? "Plano atual" : loading===plan.key ? "Processando..." : `Assinar ${plan.label}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div style={{ marginTop:40, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:16 }}>
        {[
          { q:"Posso cancelar a qualquer momento?", a:"Sim. O cancelamento é imediato e você continua com acesso até o fim do período pago." },
          { q:"A taxa é cobrada de quanto?", a:"A taxa é descontada automaticamente de cada venda realizada no seu servidor." },
          { q:"Posso mudar de plano depois?", a:"Pode fazer upgrade ou downgrade a qualquer momento. A cobrança é proporcional." },
          { q:"Como funciona o plano anual?", a:"Você paga 12 meses adiantado com 15% de desconto sobre o valor mensal." },
        ].map(faq=>(
          <div key={faq.q} className="vcard" style={{ padding:"18px 20px" }}>
            <p style={{ fontSize:13, fontWeight:700, color:"var(--s1)", marginBottom:8 }}>{faq.q}</p>
            <p style={{ fontSize:13, color:"var(--s4)", lineHeight:1.6 }}>{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
