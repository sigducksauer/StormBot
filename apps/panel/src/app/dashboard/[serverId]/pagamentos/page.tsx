"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface GatewayDef { key:string; label:string; icon:string; desc:string; fields:{key:string;label:string;type:string;optional?:boolean;opts?:string[]}[] }

const GATEWAYS: GatewayDef[] = [
  { key:"mercadopago", label:"Mercado Pago", icon:"💳", desc:"Pix automático, cartão de crédito e boleto. Integração nativa com webhook.",
    fields:[
      { key:"access_token",   label:"Access Token",   type:"password" },
      { key:"public_key",     label:"Public Key",     type:"text" },
      { key:"webhook_secret", label:"Webhook Secret", type:"password", optional:true },
    ]},
  { key:"pix_manual", label:"Pix Manual", icon:"◎", desc:"Gera QR Code com sua chave Pix. Você confirma os pagamentos manualmente pelo painel.",
    fields:[
      { key:"pix_key",       label:"Chave Pix",     type:"text" },
      { key:"pix_key_type",  label:"Tipo",          type:"select", opts:["cpf","email","telefone","aleatoria"] },
      { key:"merchant_name", label:"Nome",          type:"text" },
      { key:"merchant_city", label:"Cidade",        type:"text" },
    ]},
  { key:"stripe", label:"Stripe", icon:"⬡", desc:"Cartão internacional. Disponível no plano Premium+.",
    fields:[
      { key:"secret_key",      label:"Secret Key",      type:"password" },
      { key:"publishable_key", label:"Publishable Key", type:"text" },
      { key:"webhook_secret",  label:"Webhook Secret",  type:"password", optional:true },
    ]},
];

interface Configured { id:string; gateway_type:string; is_active:boolean }

export default function PagamentosPage() {
  const { serverId } = useParams() as { serverId:string };
  const [configured, setConfigured] = useState<Configured[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive]   = useState<string|null>(null);
  const [form, setForm]       = useState<Record<string,string>>({});
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");

  useEffect(() => { load(); }, [serverId]);

  async function load() {
    setLoading(true);
    try { setConfigured(await api.get<Configured[]>("/gateways", serverId)); }
    catch { setConfigured([]); } finally { setLoading(false); }
  }

  function isConf(k:string) { return configured.some(g=>g.gateway_type===k); }
  function isActive(k:string) { return configured.find(g=>g.gateway_type===k)?.is_active??false; }

  async function save(e:React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post(active==="pix_manual"?"/gateways/pix-manual":`/gateways/${active}`, form, serverId);
      setMsg("✅ Configurado!"); setActive(null); setForm({}); load();
    } catch (err:any) { setMsg("❌ "+(err?.message||"Erro")); }
    finally { setSaving(false); setTimeout(()=>setMsg(""),4000); }
  }

  async function toggle(k:string) {
    const g = configured.find(c=>c.gateway_type===k); if(!g) return;
    await api.patch(`/gateways/${g.id}/toggle`, {is_active:!g.is_active}, serverId).catch(()=>{});
    load();
  }

  const gwInfo = GATEWAYS.find(g=>g.key===active);

  return (
    <div className="fu">
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Formas de Pagamento</h1>
        <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>Configure os gateways que seus clientes poderão usar</p>
        {msg && <div style={{ marginTop:12, padding:"9px 14px", borderRadius:10, fontSize:13, display:"inline-block",
          background:msg.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
          border:`1px solid ${msg.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
          color:msg.startsWith("✅")?"#22c55e":"#ef4444",
        }}>{msg}</div>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 }}>
        {GATEWAYS.map(gw=>{
          const conf   = isConf(gw.key);
          const active = isActive(gw.key);
          return (
            <div key={gw.key} className="vcard" style={{ padding:24, position:"relative", borderColor: conf&&active?"rgba(34,197,94,.25)":"var(--border)" }}>
              {conf && active && (
                <div style={{ position:"absolute", top:16, right:16, width:8, height:8, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 8px rgba(34,197,94,.6)" }} />
              )}
              <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
                <div style={{ fontSize:28 }}>{gw.icon}</div>
                <div>
                  <p style={{ fontSize:15, fontWeight:700, color:"var(--s1)" }}>{gw.label}</p>
                  <p style={{ fontSize:12, color: conf ? (active?"#22c55e":"var(--s4)") : "var(--s4)", marginTop:2 }}>
                    {conf ? (active?"Ativo e configurado":"Configurado · Inativo") : "Não configurado"}
                  </p>
                </div>
              </div>

              <p style={{ fontSize:12, color:"var(--s4)", lineHeight:1.6, marginBottom:18 }}>{gw.desc}</p>

              <div style={{ display:"flex", gap:8 }}>
                <button className="vbg" style={{ flex:1, justifyContent:"center", fontSize:12, padding:"8px 0" }}
                  onClick={()=>{ setActive(gw.key); setForm({}); }}>
                  {conf?"Reconfigurar":"Configurar"}
                </button>
                {conf && (
                  <button onClick={()=>toggle(gw.key)} style={{
                    padding:"8px 14px", borderRadius:10, border:"none", cursor:"pointer", fontSize:12, fontWeight:600,
                    background: active?"rgba(239,68,68,.1)":"rgba(34,197,94,.1)",
                    color: active?"#ef4444":"#22c55e",
                  }}>{active?"Pausar":"Ativar"}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pix manual orders awaiting confirmation */}
      {isConf("pix_manual") && <PixPendentes serverId={serverId} />}

      {/* Modal */}
      {active && gwInfo && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, width:"100%", maxWidth:440, boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid var(--border)" }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:"var(--s1)" }}>{gwInfo.icon} {gwInfo.label}</h2>
              <button onClick={()=>setActive(null)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--s4)",fontSize:20 }}>✕</button>
            </div>
            <form onSubmit={save} style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:14 }}>
              {gwInfo.fields.map(f=>(
                <div key={f.key}>
                  <label style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 }}>
                    {f.label}{f.optional && <span style={{ color:"var(--s4)", fontWeight:400, marginLeft:4, textTransform:"none" }}>(opcional)</span>}
                  </label>
                  {f.type==="select" ? (
                    <select className="vi" value={form[f.key]||""} onChange={e=>setForm(fm=>({...fm,[f.key]:e.target.value}))} required={!f.optional}>
                      <option value="">Selecione...</option>
                      {f.opts?.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} className="vi" value={form[f.key]||""} onChange={e=>setForm(fm=>({...fm,[f.key]:e.target.value}))} required={!f.optional} placeholder={f.type==="password"?"••••••••••":""}/>
                  )}
                </div>
              ))}
              <div style={{ display:"flex", gap:10, marginTop:6 }}>
                <button type="button" className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={()=>setActive(null)}>Cancelar</button>
                <button type="submit" className="vbp" style={{ flex:1, justifyContent:"center" }} disabled={saving}>{saving?"Salvando...":"Salvar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PixPendentes({ serverId }: { serverId:string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    api.get<{orders:any[]}>("/orders?status=pending&gateway=pix_manual&limit=20", serverId)
      .then(d=>setOrders(d.orders||[])).catch(()=>setOrders([]))
      .finally(()=>setLoading(false));
  },[serverId]);

  async function confirm(id:string) {
    await api.post(`/orders/${id}/confirm_payment`, {}, serverId).catch(()=>{});
    setOrders(o=>o.filter(x=>x.id!==id));
  }

  if (!loading && orders.length===0) return null;

  return (
    <div style={{ marginTop:28 }}>
      <h2 style={{ fontSize:16, fontWeight:700, color:"var(--s1)", marginBottom:14 }}>Pix Manual — Aguardando confirmação</h2>
      <div className="vcard" style={{ overflow:"hidden" }}>
        {loading ? (
          <div style={{ padding:24, textAlign:"center", color:"var(--s4)", fontSize:13 }}>Carregando...</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Pedido","Cliente","Valor","Criado","Ação"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"10px 16px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o=>(
                <tr key={o.id} style={{ borderBottom:"1px solid rgba(120,50,255,.06)" }}>
                  <td style={{ padding:"12px 16px", fontFamily:"monospace", fontSize:12, color:"var(--s3)" }}>#{o.id.slice(0,8).toUpperCase()}</td>
                  <td style={{ padding:"12px 16px", fontSize:13, color:"var(--s2)" }}>{o.customer_username}</td>
                  <td style={{ padding:"12px 16px", fontSize:13, fontWeight:700, color:"#22c55e" }}>R$ {o.total?.toFixed(2)}</td>
                  <td style={{ padding:"12px 16px", fontSize:12, color:"var(--s4)" }}>{new Date(o.created_at).toLocaleString("pt-BR")}</td>
                  <td style={{ padding:"12px 16px" }}>
                    <button onClick={()=>confirm(o.id)} style={{
                      padding:"5px 14px", borderRadius:8, border:"1px solid rgba(34,197,94,.3)",
                      background:"rgba(34,197,94,.1)", color:"#22c55e", fontSize:12, fontWeight:600, cursor:"pointer",
                    }}>✓ Confirmar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
