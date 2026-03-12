"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { api } from "@/lib/api/client";

const STEPS = [
  { n:1, label:"Conectar Discord",  icon:"◉", done:true },
  { n:2, label:"Escolher servidor", icon:"◈" },
  { n:3, label:"Criar loja",        icon:"◇" },
  { n:4, label:"Primeiro produto",  icon:"◎" },
];

export default function OnboardingPage() {
  const router   = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [server, setServer] = useState<any>(null);
  const [product, setProduct] = useState({ name:"", price:"", product_type:"key", description:"" });
  const [saving, setSaving] = useState(false);

  async function finalize() {
    if (!server) return;
    setSaving(true);
    try {
      await api.post(`/onboarding/complete`, { server_id:server.id }, server.id);
      if (product.name && product.price) {
        await api.post("/products", { ...product, price:Number(product.price), stock:-1 }, server.id);
      }
      router.push(`/dashboard/${server.id}`);
    } catch {
      router.push(`/dashboard/${server.id}`);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", backgroundImage:"radial-gradient(circle, rgba(120,50,255,0.12) 1px, transparent 1px)", backgroundSize:"26px 26px", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ maxWidth:560, width:"100%" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:"linear-gradient(135deg,#7c3aed,#a855f7)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:24, color:"#fff", boxShadow:"0 8px 24px rgba(124,58,237,.4)", marginBottom:16 }}>V</div>
          <h1 style={{ fontSize:26, fontWeight:800, color:"var(--s1)", fontFamily:"Syne,sans-serif" }}>Bem-vindo ao VendBot</h1>
          <p style={{ fontSize:14, color:"var(--s3)", marginTop:6 }}>Configure sua loja em 4 passos simples</p>
        </div>

        {/* Progress */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0, marginBottom:32 }}>
          {STEPS.map((s,i) => (
            <div key={s.n} style={{ display:"flex", alignItems:"center" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                <div style={{
                  width:38, height:38, borderRadius:"50%",
                  background: step>s.n?"#22c55e":step===s.n?"#7c3aed":"rgba(255,255,255,.05)",
                  border: `2px solid ${step>s.n?"#22c55e":step===s.n?"#a855f7":"rgba(255,255,255,.1)"}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color: step>=s.n?"#fff":"var(--s4)", fontSize:step>s.n?16:13, fontWeight:700,
                  transition:"all .3s",
                }}>{step>s.n?"✓":s.icon}</div>
                <span style={{ fontSize:10, fontWeight:600, color:step>=s.n?"var(--s2)":"var(--s4)", whiteSpace:"nowrap" }}>{s.label}</span>
              </div>
              {i<STEPS.length-1 && (
                <div style={{ width:60, height:2, background:step>s.n?"#22c55e":"rgba(255,255,255,.08)", margin:"0 4px 20px", transition:"background .3s" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="vcard" style={{ padding:"28px 32px" }}>

          {step===1 && (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:16 }}>◉</div>
              <h2 style={{ fontSize:18, fontWeight:700, color:"var(--s1)", marginBottom:8 }}>Discord conectado!</h2>
              <p style={{ fontSize:14, color:"var(--s3)", marginBottom:6 }}>
                Olá, <strong style={{ color:"#a855f7" }}>{user?.username}</strong>! Você está autenticado com sucesso.
              </p>
              <p style={{ fontSize:13, color:"var(--s4)", marginBottom:28, lineHeight:1.6 }}>
                Agora vamos selecionar o servidor Discord onde você quer criar sua loja.
              </p>
              <button className="vbp" style={{ padding:"12px 32px", fontSize:15 }} onClick={()=>setStep(2)}>
                Continuar →
              </button>
            </div>
          )}

          {step===2 && (
            <div style={{ textAlign:"center" }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:"var(--s1)", marginBottom:8 }}>Escolha o servidor</h2>
              <p style={{ fontSize:13, color:"var(--s4)", marginBottom:24 }}>O VendBot deve estar adicionado ao servidor antes de continuar.</p>
              <div style={{ padding:"20px", borderRadius:12, background:"rgba(120,50,255,.08)", border:"1px dashed rgba(120,50,255,.3)", marginBottom:24 }}>
                <p style={{ fontSize:13, color:"var(--s3)", marginBottom:12 }}>Selecione o servidor nos seus servidores:</p>
                <a href="/servers" style={{ textDecoration:"none" }}>
                  <button className="vbp" style={{ padding:"11px 28px" }}>Ver meus servidores</button>
                </a>
              </div>
              <p style={{ fontSize:12, color:"var(--s4)" }}>
                Ainda não adicionou o bot?{" "}
                <a href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=8&scope=bot+applications.commands`} target="_blank" style={{ color:"#a855f7" }}>Adicionar ao servidor</a>
              </p>
            </div>
          )}

          {step===3 && (
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:"var(--s1)", marginBottom:6 }}>Configure sua loja</h2>
              <p style={{ fontSize:13, color:"var(--s4)", marginBottom:24 }}>Configure o canal da loja e comece a vender.</p>
              <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:24 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 }}>Canal da Loja (ID Discord)</label>
                  <input className="vi" placeholder="ID do canal onde a loja ficará ativa" />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 }}>Canal de Logs (opcional)</label>
                  <input className="vi" placeholder="ID do canal de logs de vendas" />
                </div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={()=>setStep(2)}>← Voltar</button>
                <button className="vbp" style={{ flex:2, justifyContent:"center" }} onClick={()=>setStep(4)}>Próximo →</button>
              </div>
            </div>
          )}

          {step===4 && (
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, color:"var(--s1)", marginBottom:6 }}>Crie seu primeiro produto</h2>
              <p style={{ fontSize:13, color:"var(--s4)", marginBottom:24 }}>Pode pular e criar depois, mas produtos são o coração da loja!</p>
              <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:24 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 }}>Nome do produto</label>
                  <input className="vi" value={product.name} onChange={e=>setProduct(p=>({...p,name:e.target.value}))} placeholder="Ex: VIP Mensal, IPTV Básico..." />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 }}>Preço (R$)</label>
                    <input type="number" step="0.01" className="vi" value={product.price} onChange={e=>setProduct(p=>({...p,price:e.target.value}))} placeholder="29.90" />
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 }}>Tipo de entrega</label>
                    <select className="vi" value={product.product_type} onChange={e=>setProduct(p=>({...p,product_type:e.target.value}))}>
                      <option value="key">◈ Chave / Serial</option>
                      <option value="digital">◉ Arquivo Digital</option>
                      <option value="role">⬡ Cargo Discord</option>
                      <option value="channel">◇ Canal Discord</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={()=>setStep(3)}>← Voltar</button>
                <button className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={finalize} disabled={saving}>Pular</button>
                <button className="vbp" style={{ flex:2, justifyContent:"center" }} onClick={finalize} disabled={saving}>{saving?"Configurando...":"🚀 Finalizar!"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
