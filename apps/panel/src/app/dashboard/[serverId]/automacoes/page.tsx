"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Automation {
  id:string; name:string; trigger:string; trigger_label:string;
  conditions:any; actions:any[]; is_active:boolean; run_count:number; created_at:string;
}

const TRIGGERS = [
  { v:"order_created",         l:"Pedido criado",                icon:"◉", color:"#60a5fa" },
  { v:"order_paid",            l:"Pagamento confirmado",         icon:"◈", color:"#22c55e" },
  { v:"order_delivered",       l:"Pedido entregue",              icon:"◇", color:"#a855f7" },
  { v:"order_expired",         l:"Pedido expirado",              icon:"◎", color:"#f59e0b" },
  { v:"cart_abandoned",        l:"Carrinho abandonado",          icon:"⬡", color:"#fb923c" },
  { v:"stock_low",             l:"Estoque baixo",                icon:"◬", color:"#ef4444" },
  { v:"post_purchase",         l:"Pós-compra (agradecimento)",   icon:"⬢", color:"#34d399" },
  { v:"subscription_expiring", l:"Assinatura expirando",         icon:"▦", color:"#e879f9" },
  { v:"promotion",             l:"Promoção programada",          icon:"◆", color:"#fbbf24" },
];

const ACTIONS = [
  { v:"dm",            l:"Enviar DM ao cliente",        color:"#60a5fa" },
  { v:"give_role",     l:"Atribuir cargo no Discord",   color:"#22c55e" },
  { v:"remove_role",   l:"Remover cargo no Discord",    color:"#f87171" },
  { v:"send_channel",  l:"Enviar mensagem no canal",    color:"#f59e0b" },
  { v:"apply_coupon",  l:"Aplicar cupom automático",    color:"#34d399" },
  { v:"webhook",       l:"Disparar webhook externo",    color:"#e879f9" },
  { v:"notify_staff",  l:"Notificar equipe interna",    color:"#fb923c" },
];

const EMPTY_FORM = { name:"", trigger:"order_paid", actions:[{type:"dm",message:""}] };

export default function AutomacoesPage() {
  const { serverId } = useParams() as { serverId:string };
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, [serverId]);

  async function load() {
    setLoading(true);
    try { setAutomations(await api.get<Automation[]>("/automations", serverId)); }
    catch { setAutomations([]); } finally { setLoading(false); }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post("/automations", form, serverId);
      toast("Automação criada!"); setOpen(false); setForm(EMPTY_FORM); load();
    } catch(err:any) { toast(err?.message||"Erro",true); }
    finally { setSaving(false); }
  }

  async function toggle(a: Automation) {
    await api.patch(`/automations/${a.id}`, { is_active:!a.is_active }, serverId).catch(()=>{});
    load();
  }

  async function remove(id: string) {
    if (!confirm("Excluir automação?")) return;
    await api.delete(`/automations/${id}`, serverId).catch(()=>{}); load();
  }

  function addAction() {
    setForm((f:any) => ({ ...f, actions:[...f.actions,{type:"dm",message:""}] }));
  }
  function updateAction(i:number, k:string, v:string) {
    setForm((f:any) => {
      const a = [...f.actions]; a[i]={...a[i],[k]:v}; return {...f,actions:a};
    });
  }
  function removeAction(i:number) {
    setForm((f:any) => ({ ...f, actions:f.actions.filter((_:any,j:number)=>j!==i) }));
  }

  function toast(m:string,err=false) { setMsg((err?"❌ ":"✅ ")+m); setTimeout(()=>setMsg(""),3000); }

  const active = automations.filter(a=>a.is_active).length;

  return (
    <div className="fu">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Automações</h1>
          <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>
            <span style={{ color:"#22c55e", fontWeight:600 }}>{active} ativas</span>
            {automations.length-active > 0 && <span style={{ color:"var(--s4)", marginLeft:8 }}>· {automations.length-active} inativas</span>}
          </p>
        </div>
        <button className="vbp" onClick={()=>setOpen(true)}>+ Nova Automação</button>
      </div>

      {msg && <div style={{ marginBottom:16, padding:"9px 14px", borderRadius:10, fontSize:13,
        background:msg.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
        border:`1px solid ${msg.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
        color:msg.startsWith("✅")?"#22c55e":"#ef4444" }}>{msg}</div>}

      {/* Trigger grid explanation */}
      {!loading && automations.length===0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12, marginBottom:24 }}>
          {TRIGGERS.slice(0,6).map(t=>(
            <div key={t.v} className="vcard" style={{ padding:"16px 18px", borderColor:`${t.color}22` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <span style={{ fontSize:18, color:t.color }}>{t.icon}</span>
                <p style={{ fontSize:13, fontWeight:700, color:"var(--s1)" }}>{t.l}</p>
              </div>
              <p style={{ fontSize:12, color:"var(--s4)", lineHeight:1.5 }}>
                Dispara automações quando {t.l.toLowerCase()} ocorrer
              </p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[1,2,3].map(i=><div key={i} style={{ height:90, borderRadius:12, background:"rgba(120,50,255,.06)" }} />)}
        </div>
      ) : automations.length===0 ? (
        <div className="vcard" style={{ textAlign:"center", padding:"64px 20px" }}>
          <div style={{ fontSize:36, marginBottom:14 }}>⬢</div>
          <p style={{ fontSize:16, fontWeight:700, color:"var(--s2)", marginBottom:8 }}>Nenhuma automação criada</p>
          <p style={{ fontSize:13, color:"var(--s4)", marginBottom:24 }}>Crie fluxos automáticos para DMs, cargos, cupons e mais</p>
          <button className="vbp" onClick={()=>setOpen(true)}>+ Criar Automação</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {automations.map(a=>{
            const trig = TRIGGERS.find(t=>t.v===a.trigger);
            return (
              <div key={a.id} className="vcard" style={{ padding:"18px 22px", display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap", borderColor:a.is_active?`${trig?.color||"#7c3aed"}22`:"var(--border)" }}>
                <div style={{ flex:1, minWidth:220 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:18, color:trig?.color||"#a855f7" }}>{trig?.icon}</span>
                    <p style={{ fontSize:14, fontWeight:700, color:"var(--s1)" }}>{a.name}</p>
                    {!a.is_active && <span style={{ fontSize:11, padding:"2px 8px", borderRadius:100, background:"rgba(71,85,105,.1)", color:"var(--s4)" }}>Inativa</span>}
                  </div>
                  <p style={{ fontSize:12, color:"var(--s4)", marginBottom:10 }}>
                    Gatilho: <span style={{ color:trig?.color||"var(--s3)", fontWeight:600 }}>{trig?.l||a.trigger}</span>
                    <span style={{ marginLeft:12, color:"var(--s4)" }}>· {a.run_count} execuções</span>
                  </p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {a.actions?.map((ac:any,i:number)=>{
                      const aInfo = ACTIONS.find(x=>x.v===ac.type);
                      return (
                        <span key={i} style={{
                          fontSize:11, padding:"2px 9px", borderRadius:100, fontWeight:600,
                          background:`${aInfo?.color||"#7c3aed"}15`,
                          border:`1px solid ${aInfo?.color||"#7c3aed"}30`,
                          color:aInfo?.color||"#a855f7",
                        }}>{aInfo?.l||ac.type}</span>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                  <div onClick={()=>toggle(a)} style={{
                    width:42, height:24, borderRadius:100,
                    background:a.is_active?"#7c3aed":"rgba(255,255,255,.08)",
                    position:"relative", cursor:"pointer",
                    border:`1px solid ${a.is_active?"#7c3aed":"rgba(255,255,255,.1)"}`,
                    transition:"background .2s", flexShrink:0,
                  }}>
                    <div style={{
                      position:"absolute", top:3, width:16, height:16, borderRadius:"50%",
                      background:"#fff", transition:"left .2s",
                      left:a.is_active?22:3, boxShadow:"0 1px 4px rgba(0,0,0,.4)",
                    }} />
                  </div>
                  <button onClick={()=>remove(a.id)} style={{
                    fontSize:11, padding:"5px 12px", borderRadius:7,
                    border:"1px solid rgba(239,68,68,.3)", background:"rgba(239,68,68,.08)",
                    color:"#ef4444", cursor:"pointer",
                  }}>Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16, overflowY:"auto" }}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, width:"100%", maxWidth:560, boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid var(--border)" }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:"var(--s1)" }}>Nova Automação</h2>
              <button onClick={()=>setOpen(false)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--s4)",fontSize:20 }}>✕</button>
            </div>
            <form onSubmit={create} style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <label style={LS}>Nome da automação *</label>
                <input className="vi" value={form.name} onChange={e=>setForm((f:any)=>({...f,name:e.target.value}))} placeholder="Ex: DM pós-compra" required />
              </div>
              <div>
                <label style={LS}>Gatilho *</label>
                <select className="vi" value={form.trigger} onChange={e=>setForm((f:any)=>({...f,trigger:e.target.value}))}>
                  {TRIGGERS.map(t=><option key={t.v} value={t.v}>{t.icon} {t.l}</option>)}
                </select>
              </div>

              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <label style={LS}>Ações</label>
                  <button type="button" onClick={addAction} style={{ fontSize:11, padding:"4px 10px", borderRadius:7, border:"1px solid rgba(120,50,255,.3)", background:"rgba(120,50,255,.1)", color:"#a855f7", cursor:"pointer" }}>+ Ação</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {form.actions.map((ac:any, i:number) => (
                    <div key={i} style={{ padding:14, borderRadius:10, background:"rgba(120,50,255,.06)", border:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <select className="vi" value={ac.type} onChange={e=>updateAction(i,"type",e.target.value)} style={{ flex:1 }}>
                          {ACTIONS.map(a=><option key={a.v} value={a.v}>{a.l}</option>)}
                        </select>
                        {form.actions.length>1 && (
                          <button type="button" onClick={()=>removeAction(i)} style={{ background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:16,flexShrink:0 }}>✕</button>
                        )}
                      </div>
                      {(ac.type==="dm"||ac.type==="send_channel") && (
                        <textarea className="vi" style={{ height:60, resize:"none", fontSize:12 }} value={ac.message||""} onChange={e=>updateAction(i,"message",e.target.value)}
                          placeholder="Mensagem... Use: {usuario} {produto} {pedido} {servidor}" />
                      )}
                      {(ac.type==="give_role"||ac.type==="remove_role") && (
                        <input className="vi" style={{ fontSize:12 }} value={ac.role_id||""} onChange={e=>updateAction(i,"role_id",e.target.value)} placeholder="ID do cargo Discord" />
                      )}
                      {ac.type==="apply_coupon" && (
                        <input className="vi" style={{ fontSize:12 }} value={ac.coupon_code||""} onChange={e=>updateAction(i,"coupon_code",e.target.value)} placeholder="Código do cupom (ex: PROMO20)" />
                      )}
                      {ac.type==="webhook" && (
                        <input className="vi" style={{ fontSize:12 }} value={ac.url||""} onChange={e=>updateAction(i,"url",e.target.value)} placeholder="https://..." />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding:"12px 14px", borderRadius:10, background:"rgba(120,50,255,.06)", border:"1px solid rgba(120,50,255,.12)" }}>
                <p style={{ fontSize:12, color:"var(--s3)", lineHeight:1.6 }}>
                  A automação será executada automaticamente quando o gatilho selecionado ocorrer no servidor.
                  Variáveis disponíveis: <code style={{ fontSize:11 }}>{"{usuario}"} {"{produto}"} {"{pedido}"}</code>
                </p>
              </div>

              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={()=>setOpen(false)}>Cancelar</button>
                <button type="submit" className="vbp" style={{ flex:1, justifyContent:"center" }} disabled={saving}>{saving?"Criando...":"Criar Automação"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const LS = { fontSize:11, fontWeight:700 as const, textTransform:"uppercase" as const, letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 };
