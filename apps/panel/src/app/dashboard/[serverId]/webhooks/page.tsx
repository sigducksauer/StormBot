"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Webhook { id:string; url:string; events:string[]; is_active:boolean; created_at:string }

const ALL_EVENTS = ["order.created","order.paid","order.delivered","order.refunded","order.expired","product.low_stock"];

export default function WebhooksPage() {
  const { serverId } = useParams() as { serverId:string };
  const [hooks, setHooks]   = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [url, setUrl]         = useState("");
  const [events, setEvents]   = useState(["order.paid","order.delivered"]);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");
  const [testing, setTesting] = useState<string|null>(null);

  useEffect(()=>{load();},[serverId]);
  async function load() {
    setLoading(true);
    try { setHooks(await api.get<Webhook[]>("/webhooks",serverId)); }
    catch { setHooks([]); } finally { setLoading(false); }
  }

  async function create(e:React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post("/webhooks",{url,events},serverId);
      toast("Webhook criado!"); setOpen(false); setUrl(""); setEvents(["order.paid","order.delivered"]); load();
    } catch(err:any) { toast(err?.message||"Erro",true); }
    finally { setSaving(false); }
  }

  async function remove(id:string) {
    if(!confirm("Excluir este webhook?")) return;
    await api.delete(`/webhooks/${id}`,serverId).catch(()=>{}); load();
  }

  async function test(id:string) {
    setTesting(id);
    try {
      await api.post(`/webhooks/${id}/test`,{},serverId);
      toast("Evento de teste enviado!");
    } catch { toast("Erro ao enviar teste",true); }
    finally { setTesting(null); }
  }

  function toggle(ev:string) {
    setEvents(e=>e.includes(ev)?e.filter(x=>x!==ev):[...e,ev]);
  }

  function toast(m:string,err=false) { setMsg((err?"❌ ":"✅ ")+m); setTimeout(()=>setMsg(""),3000); }

  return (
    <div className="fu">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:"var(--s1)"}}>Webhooks</h1>
          <p style={{fontSize:13,color:"var(--s3)",marginTop:3}}>Receba notificações de eventos em sistemas externos</p>
        </div>
        <button className="vbp" onClick={()=>setOpen(true)}>+ Novo Webhook</button>
      </div>
      {msg && <div style={{marginBottom:16,padding:"9px 14px",borderRadius:10,fontSize:13,
        background:msg.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
        border:`1px solid ${msg.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
        color:msg.startsWith("✅")?"#22c55e":"#ef4444"}}>{msg}</div>}

      {loading ? (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[1,2].map(i=><div key={i} style={{height:90,borderRadius:12,background:"rgba(120,50,255,.06)"}} />)}
        </div>
      ) : hooks.length===0 ? (
        <div className="vcard" style={{textAlign:"center",padding:"64px 20px"}}>
          <div style={{fontSize:36,marginBottom:14}}>⬢</div>
          <p style={{fontSize:16,fontWeight:700,color:"var(--s2)",marginBottom:8}}>Nenhum webhook configurado</p>
          <p style={{fontSize:13,color:"var(--s4)",marginBottom:24}}>Integre com seu sistema de gestão, CRM ou Discord</p>
          <button className="vbp" onClick={()=>setOpen(true)}>+ Criar Webhook</button>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {hooks.map(h=>(
            <div key={h.id} className="vcard" style={{padding:"18px 22px",display:"flex",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:200}}>
                <p style={{fontSize:13,fontWeight:700,color:"var(--s1)",fontFamily:"monospace",marginBottom:8,wordBreak:"break-all"}}>{h.url}</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {h.events.map(e=>(
                    <span key={e} style={{fontSize:11,padding:"2px 8px",borderRadius:100,background:"rgba(120,50,255,.14)",border:"1px solid rgba(120,50,255,.25)",color:"#c8bfe8",fontFamily:"monospace"}}>{e}</span>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button onClick={()=>test(h.id)} disabled={testing===h.id} style={{
                  fontSize:12,padding:"6px 14px",borderRadius:8,border:"1px solid rgba(96,165,250,.3)",
                  background:"rgba(96,165,250,.08)",color:"#60a5fa",cursor:"pointer",fontWeight:600,
                }}>{testing===h.id?"Enviando...":"Testar"}</button>
                <button onClick={()=>remove(h.id)} style={{
                  fontSize:12,padding:"6px 14px",borderRadius:8,border:"1px solid rgba(239,68,68,.3)",
                  background:"rgba(239,68,68,.08)",color:"#ef4444",cursor:"pointer",fontWeight:600,
                }}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,width:"100%",maxWidth:480,boxShadow:"0 24px 64px rgba(0,0,0,.5)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px 16px",borderBottom:"1px solid var(--border)"}}>
              <h2 style={{fontSize:16,fontWeight:700,color:"var(--s1)"}}>Novo Webhook</h2>
              <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--s4)",fontSize:20}}>✕</button>
            </div>
            <form onSubmit={create} style={{padding:"20px 24px 24px",display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--s4)",display:"block",marginBottom:6}}>URL de destino *</label>
                <input className="vi" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." required />
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--s4)",display:"block",marginBottom:10}}>Eventos</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {ALL_EVENTS.map(ev=>(
                    <label key={ev} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 12px",borderRadius:8,border:`1px solid ${events.includes(ev)?"rgba(120,50,255,.3)":"var(--border)"}`,background:events.includes(ev)?"rgba(120,50,255,.08)":"transparent"}}>
                      <input type="checkbox" checked={events.includes(ev)} onChange={()=>toggle(ev)} style={{accentColor:"#7c3aed",flexShrink:0}} />
                      <span style={{fontSize:11,color:"var(--s2)",fontFamily:"monospace"}}>{ev}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{padding:"12px 14px",borderRadius:10,background:"rgba(120,50,255,.06)",border:"1px solid rgba(120,50,255,.12)"}}>
                <p style={{fontSize:12,color:"var(--s3)",lineHeight:1.6}}>
                  A URL receberá requisições POST com payload JSON contendo os dados do evento. 
                  Use o botão "Testar" após criar para verificar a integração.
                </p>
              </div>
              <div style={{display:"flex",gap:10}}>
                <button type="button" className="vbg" style={{flex:1,justifyContent:"center"}} onClick={()=>setOpen(false)}>Cancelar</button>
                <button type="submit" className="vbp" style={{flex:1,justifyContent:"center"}} disabled={saving}>{saving?"Salvando...":"Criar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
