"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Ticket {
  id:string; subject:string; status:string; priority:string;
  customer_id:string; rating:number|null; created_at:string; closed_at:string|null;
}
interface TicketDetail extends Ticket {
  messages: { id:string; author_name:string; content:string; is_staff:boolean; created_at:string }[]
}

const STATUS = {
  open:{"label":"Aberto","c":"#22c55e","bg":"rgba(34,197,94,.12)"},
  pending:{"label":"Pendente","c":"#f59e0b","bg":"rgba(245,158,11,.12)"},
  closed:{"label":"Fechado","c":"var(--s4)","bg":"rgba(71,85,105,.1)"},
  resolved:{"label":"Resolvido","c":"#a855f7","bg":"rgba(168,85,247,.12)"},
} as Record<string,any>;

const PRI = { low:"Baixa",normal:"Normal",high:"Alta",urgent:"Urgente" };
const PRI_C = { low:"var(--s4)",normal:"var(--s3)",high:"#f59e0b",urgent:"#ef4444" };

export default function TicketsPage() {
  const { serverId } = useParams() as { serverId:string };
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<TicketDetail|null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{tickets:Ticket[];total:number}>(`/tickets?limit=50${filter?`&status=${filter}`:""}`, serverId);
      setTickets(d.tickets||[]); setTotal(d.total||0);
    } catch { setTickets([]); } finally { setLoading(false); }
  }, [serverId, filter]);

  useEffect(() => { load(); }, [load]);

  async function openTicket(t: Ticket) {
    const d = await api.get<TicketDetail>(`/tickets/${t.id}`, serverId).catch(()=>null);
    if (d) setSelected(d);
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${selected.id}/messages`, { author_id:0, author_name:"Staff", content:reply, is_staff:true }, serverId);
      setReply(""); openTicket(selected);
    } catch {} finally { setSending(false); }
  }

  async function closeTicket(id: string) {
    const rating = confirm("Fechar ticket?");
    if (!rating) return;
    await api.post(`/tickets/${id}/close`, {}, serverId).catch(()=>{});
    load();
    if (selected?.id===id) setSelected(null);
  }

  const FILTERS = ["","open","pending","resolved","closed"];

  return (
    <div className="fu" style={{ display:"flex", gap:20, alignItems:"flex-start", height:"calc(100vh-80px)" }}>
      {/* List */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Tickets</h1>
            <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>{total} tickets no total</p>
          </div>
          <div style={{ display:"flex", gap:5 }}>
            {FILTERS.map(f=>{
              const st = STATUS[f];
              return (
                <button key={f} onClick={()=>setFilter(f)} style={{
                  padding:"5px 12px", borderRadius:100, border:"1px solid", cursor:"pointer", fontSize:12, fontWeight:600,
                  background: filter===f?"rgba(124,58,237,.18)":"transparent",
                  borderColor: filter===f?"rgba(168,85,247,.5)":"var(--border)",
                  color: filter===f?"#c8bfe8":"var(--s4)",
                }}>{f===""?"Todos":st?.label}</button>
              );
            })}
          </div>
        </div>

        <div className="vcard" style={{ overflow:"hidden" }}>
          {loading ? (
            Array.from({length:6}).map((_,i)=>(
              <div key={i} style={{ padding:"14px 20px", borderBottom:"1px solid rgba(120,50,255,.06)" }}>
                <div style={{ height:14, width:"60%", background:"rgba(120,50,255,.06)", borderRadius:4, marginBottom:6 }} />
                <div style={{ height:10, width:"40%", background:"rgba(120,50,255,.04)", borderRadius:4 }} />
              </div>
            ))
          ) : tickets.length===0 ? (
            <div style={{ textAlign:"center", padding:"64px 20px", color:"var(--s4)", fontSize:14 }}>Nenhum ticket encontrado</div>
          ) : tickets.map(t=>{
            const st = STATUS[t.status] || STATUS.open;
            return (
              <div key={t.id} onClick={()=>openTicket(t)}
                style={{ padding:"14px 20px", borderBottom:"1px solid rgba(120,50,255,.06)", cursor:"pointer", transition:"background .12s", background:selected?.id===t.id?"rgba(120,50,255,.06)":"transparent" }}
                onMouseEnter={e=>{if(selected?.id!==t.id)(e.currentTarget as any).style.background="rgba(120,50,255,.04)"}}
                onMouseLeave={e=>{if(selected?.id!==t.id)(e.currentTarget as any).style.background="transparent"}}
              >
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                  <p style={{ fontSize:14, fontWeight:600, color:"var(--s1)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.subject}</p>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:100, background:st.bg, color:st.c, fontWeight:600, flexShrink:0 }}>{st.label}</span>
                </div>
                <div style={{ display:"flex", gap:12, marginTop:5 }}>
                  <span style={{ fontSize:11, color:(PRI_C as any)[t.priority]||"var(--s4)" }}>{(PRI as any)[t.priority]}</span>
                  <span style={{ fontSize:11, color:"var(--s4)" }}>{new Date(t.created_at).toLocaleDateString("pt-BR")}</span>
                  {t.rating && <span style={{ fontSize:11, color:"#f59e0b" }}>{"★".repeat(t.rating)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      {selected && (
        <div className="vcard" style={{ width:420, flexShrink:0, display:"flex", flexDirection:"column", maxHeight:"85vh" }}>
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div>
              <p style={{ fontSize:14, fontWeight:700, color:"var(--s1)" }}>{selected.subject}</p>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <span style={{ fontSize:11, color:(STATUS[selected.status]?.c)||"var(--s3)" }}>{STATUS[selected.status]?.label}</span>
                <span style={{ fontSize:11, color:(PRI_C as any)[selected.priority]||"var(--s4)" }}>{(PRI as any)[selected.priority]}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {selected.status!=="closed" && (
                <button onClick={()=>closeTicket(selected.id)} style={{ fontSize:11, padding:"5px 12px", borderRadius:8, border:"1px solid rgba(239,68,68,.3)", background:"rgba(239,68,68,.08)", color:"#ef4444", cursor:"pointer" }}>Fechar</button>
              )}
              <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--s4)", fontSize:18 }}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
            {selected.messages?.map(m=>(
              <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems:m.is_staff?"flex-end":"flex-start" }}>
                <div style={{
                  maxWidth:"85%", padding:"10px 14px", borderRadius:12,
                  background: m.is_staff?"rgba(124,58,237,.18)":"rgba(255,255,255,.05)",
                  border: `1px solid ${m.is_staff?"rgba(124,58,237,.3)":"rgba(255,255,255,.08)"}`,
                }}>
                  <p style={{ fontSize:11, fontWeight:700, color:m.is_staff?"#a855f7":"var(--s3)", marginBottom:4 }}>{m.author_name}</p>
                  <p style={{ fontSize:13, color:"var(--s2)", lineHeight:1.5 }}>{m.content}</p>
                  <p style={{ fontSize:10, color:"var(--s4)", marginTop:4 }}>{new Date(m.created_at).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply */}
          {selected.status!=="closed" && (
            <div style={{ padding:"14px 20px", borderTop:"1px solid var(--border)", display:"flex", gap:8, flexShrink:0 }}>
              <textarea className="vi" style={{ flex:1, height:70, resize:"none", fontSize:13 }} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Responder ao cliente..." />
              <button className="vbp" style={{ alignSelf:"flex-end", padding:"9px 16px" }} onClick={sendReply} disabled={sending||!reply.trim()}>
                {sending?"...":"→"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
