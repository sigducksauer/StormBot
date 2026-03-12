"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Customer {
  id:string; discord_id:number; username:string; email:string|null;
  total_spent:number; order_count:number; is_blacklisted:boolean;
  blacklist_reason:string|null; tags:string[]; notes:string|null;
  first_purchase:string|null; last_purchase:string|null; created_at:string;
}
interface CustomerOrder {
  id:string; total:number; status:string; gateway:string; created_at:string;
}

const LIMIT = 20;

export default function ClientesPage() {
  const { serverId } = useParams() as { serverId:string };
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(0);
  const [selected,  setSelected]  = useState<Customer|null>(null);
  const [orders,    setOrders]    = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{customers:Customer[];total:number}>(
        `/customers?limit=${LIMIT}&offset=${page*LIMIT}${search?`&search=${encodeURIComponent(search)}`:""}`, serverId);
      setCustomers(d.customers||[]); setTotal(d.total||0);
    } catch { setCustomers([]); setTotal(0); } finally { setLoading(false); }
  }, [serverId, page, search]);

  useEffect(() => { load(); }, [load]);

  async function openCustomer(c: Customer) {
    setSelected(c); setLoadingOrders(true);
    try {
      const d = await api.get<{orders:CustomerOrder[]}>(`/customers/${c.id}/orders`, serverId);
      setOrders(d.orders||[]);
    } catch { setOrders([]); } finally { setLoadingOrders(false); }
  }

  async function toggleBlacklist(c: Customer) {
    const reason = c.is_blacklisted ? null : prompt("Motivo do bloqueio:");
    if (!c.is_blacklisted && !reason) return;
    try {
      await api.patch(`/customers/${c.id}`, { is_blacklisted:!c.is_blacklisted, blacklist_reason:reason }, serverId);
      toast(c.is_blacklisted ? "Bloqueio removido" : "Cliente bloqueado!");
      load();
      if (selected?.id===c.id) setSelected({...c, is_blacklisted:!c.is_blacklisted});
    } catch(err:any) { toast(err?.message||"Erro",true); }
  }

  async function saveNotes(c: Customer, notes: string) {
    await api.patch(`/customers/${c.id}`, { notes }, serverId).catch(()=>{});
    setSelected({...c, notes});
  }

  function toast(m:string,err=false) { setMsg((err?"❌ ":"✅ ")+m); setTimeout(()=>setMsg(""),3000); }

  const totalPages = Math.ceil(total/LIMIT);
  const topCustomers = [...customers].sort((a,b)=>b.total_spent-a.total_spent).slice(0,3);

  const STATUS_C: Record<string,{c:string;bg:string;l:string}> = {
    pending:  {c:"#f59e0b",bg:"rgba(245,158,11,.12)",l:"Pendente"},
    paid:     {c:"#22c55e",bg:"rgba(34,197,94,.12)",l:"Pago"},
    delivered:{c:"#a855f7",bg:"rgba(168,85,247,.12)",l:"Entregue"},
    refunded: {c:"#64748b",bg:"rgba(100,116,139,.12)",l:"Reembolsado"},
    expired:  {c:"#475569",bg:"rgba(71,85,105,.12)",l:"Expirado"},
  };

  return (
    <div className="fu" style={{ display:"flex", gap:20, alignItems:"flex-start" }}>

      {/* ── Left: list ── */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Clientes</h1>
            <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>{total} clientes cadastrados</p>
          </div>
          <input className="vi" style={{ width:240 }} placeholder="Buscar por username ou ID..." value={search}
            onChange={e=>{ setSearch(e.target.value); setPage(0); }} />
        </div>

        {msg && <div style={{ marginBottom:14, padding:"9px 14px", borderRadius:10, fontSize:13,
          background:msg.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
          border:`1px solid ${msg.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
          color:msg.startsWith("✅")?"#22c55e":"#ef4444"}}>{msg}</div>}

        {/* Top spenders */}
        {!loading && topCustomers.length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12, marginBottom:18 }}>
            {topCustomers.map((c,i) => (
              <div key={c.id} className="vcard" style={{ padding:"14px 16px", cursor:"pointer", borderColor:i===0?"rgba(245,158,11,.3)":undefined }}
                onClick={()=>openCustomer(c)}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <span style={{ fontSize:16 }}>{["🥇","🥈","🥉"][i]}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"var(--s1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.username}</span>
                </div>
                <p style={{ fontSize:18, fontWeight:800, color:"#22c55e" }}>R$ {c.total_spent.toFixed(2)}</p>
                <p style={{ fontSize:11, color:"var(--s4)", marginTop:2 }}>{c.order_count} pedidos</p>
              </div>
            ))}
          </div>
        )}

        <div className="vcard" style={{ overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Cliente","Total Gasto","Pedidos","Primeiro","Último","Status",""].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"11px 16px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:8}).map((_,i)=>(
                <tr key={i}><td colSpan={7} style={{ padding:"12px 16px" }}>
                  <div style={{ height:12, background:"rgba(120,50,255,.06)", borderRadius:4 }} />
                </td></tr>
              )) : customers.length===0 ? (
                <tr><td colSpan={7} style={{ textAlign:"center", padding:"64px", color:"var(--s4)", fontSize:14 }}>
                  {search ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
                </td></tr>
              ) : customers.map(c=>(
                <tr key={c.id}
                  style={{ borderBottom:"1px solid rgba(120,50,255,.06)", cursor:"pointer", transition:"background .12s", background:selected?.id===c.id?"rgba(120,50,255,.06)":"transparent" }}
                  onClick={()=>openCustomer(c)}
                >
                  <td style={{ padding:"12px 16px" }}>
                    <p style={{ fontSize:13, fontWeight:600, color: c.is_blacklisted?"#ef4444":"var(--s1)" }}>{c.username}</p>
                    {c.email && <p style={{ fontSize:11, color:"var(--s4)" }}>{c.email}</p>}
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:13, fontWeight:700, color:"#22c55e" }}>R$ {c.total_spent.toFixed(2)}</td>
                  <td style={{ padding:"12px 16px", fontSize:13, color:"var(--s3)" }}>{c.order_count}</td>
                  <td style={{ padding:"12px 16px", fontSize:11, color:"var(--s4)" }}>{c.first_purchase?new Date(c.first_purchase).toLocaleDateString("pt-BR"):"—"}</td>
                  <td style={{ padding:"12px 16px", fontSize:11, color:"var(--s4)" }}>{c.last_purchase?new Date(c.last_purchase).toLocaleDateString("pt-BR"):"—"}</td>
                  <td style={{ padding:"12px 16px" }}>
                    {c.is_blacklisted ? (
                      <span className="badge" style={{ background:"rgba(239,68,68,.12)", color:"#ef4444" }}>⛔ Bloqueado</span>
                    ) : (
                      <span className="badge" style={{ background:"rgba(34,197,94,.1)", color:"#22c55e" }}>✓ Ativo</span>
                    )}
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <button onClick={e=>{ e.stopPropagation(); toggleBlacklist(c); }} style={{
                      fontSize:11, padding:"4px 10px", borderRadius:7,
                      border:`1px solid ${c.is_blacklisted?"rgba(34,197,94,.3)":"rgba(239,68,68,.3)"}`,
                      background:c.is_blacklisted?"rgba(34,197,94,.08)":"rgba(239,68,68,.08)",
                      color:c.is_blacklisted?"#22c55e":"#ef4444", cursor:"pointer",
                    }}>{c.is_blacklisted?"Desbloquear":"Bloquear"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages>1 && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14 }}>
            <p style={{ fontSize:13, color:"var(--s4)" }}>{page*LIMIT+1}–{Math.min((page+1)*LIMIT,total)} de {total}</p>
            <div style={{ display:"flex", gap:6 }}>
              <button className="vbg" style={{ padding:"7px 14px", fontSize:13 }} disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Ant.</button>
              <span style={{ padding:"7px 14px", fontSize:13, color:"var(--s3)" }}>{page+1}/{totalPages}</span>
              <button className="vbg" style={{ padding:"7px 14px", fontSize:13 }} disabled={page+1>=totalPages} onClick={()=>setPage(p=>p+1)}>Próx. →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: detail ── */}
      {selected && (
        <div style={{ width:360, flexShrink:0 }}>
          <div className="vcard" style={{ padding:0, overflow:"hidden", position:"sticky", top:0 }}>
            {/* Header */}
            <div style={{ padding:"18px 20px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <p style={{ fontSize:15, fontWeight:700, color: selected.is_blacklisted?"#ef4444":"var(--s1)" }}>{selected.username}</p>
                <p style={{ fontSize:12, color:"var(--s4)", marginTop:2 }}>
                  ID: {selected.discord_id}
                </p>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--s4)",fontSize:18 }}>✕</button>
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0 }}>
              {[
                { l:"Total gasto",  v:`R$ ${selected.total_spent.toFixed(2)}`, c:"#22c55e" },
                { l:"Pedidos",      v:String(selected.order_count),            c:"#60a5fa" },
              ].map((s,i)=>(
                <div key={i} style={{ padding:"14px 20px", borderBottom:"1px solid var(--border)", borderRight:i===0?"1px solid var(--border)":"none" }}>
                  <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", marginBottom:4 }}>{s.l}</p>
                  <p style={{ fontSize:18, fontWeight:800, color:s.c }}>{s.v}</p>
                </div>
              ))}
            </div>

            {/* Tags */}
            {selected.tags?.length > 0 && (
              <div style={{ padding:"12px 20px", borderBottom:"1px solid var(--border)", display:"flex", flexWrap:"wrap", gap:5 }}>
                {selected.tags.map(t=>(
                  <span key={t} style={{ fontSize:11, padding:"2px 8px", borderRadius:100, background:"rgba(120,50,255,.12)", border:"1px solid rgba(120,50,255,.2)", color:"#c8bfe8" }}>{t}</span>
                ))}
              </div>
            )}

            {/* Notes */}
            <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--border)" }}>
              <p style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", marginBottom:8 }}>Anotações internas</p>
              <NoteEditor initial={selected.notes||""} onSave={n=>saveNotes(selected,n)} />
            </div>

            {/* Bloqueio */}
            <div style={{ padding:"12px 20px", borderBottom:"1px solid var(--border)" }}>
              {selected.is_blacklisted && selected.blacklist_reason && (
                <p style={{ fontSize:12, color:"#ef4444", marginBottom:8 }}>⛔ {selected.blacklist_reason}</p>
              )}
              <button onClick={()=>toggleBlacklist(selected)} style={{
                width:"100%", padding:"8px", borderRadius:9,
                border:`1px solid ${selected.is_blacklisted?"rgba(34,197,94,.3)":"rgba(239,68,68,.3)"}`,
                background:selected.is_blacklisted?"rgba(34,197,94,.08)":"rgba(239,68,68,.08)",
                color:selected.is_blacklisted?"#22c55e":"#ef4444",
                cursor:"pointer", fontSize:13, fontWeight:600,
              }}>{selected.is_blacklisted?"✓ Remover bloqueio":"⛔ Bloquear cliente"}</button>
            </div>

            {/* Orders */}
            <div style={{ padding:"14px 20px 0" }}>
              <p style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", marginBottom:12 }}>Histórico de pedidos</p>
              {loadingOrders ? (
                <p style={{ fontSize:12, color:"var(--s4)", textAlign:"center", padding:"20px 0" }}>Carregando...</p>
              ) : orders.length===0 ? (
                <p style={{ fontSize:12, color:"var(--s4)", textAlign:"center", padding:"20px 0" }}>Nenhum pedido</p>
              ) : (
                <div style={{ maxHeight:260, overflowY:"auto" }}>
                  {orders.map(o=>{
                    const st = STATUS_C[o.status] || {c:"var(--s3)",bg:"transparent",l:o.status};
                    return (
                      <div key={o.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid rgba(120,50,255,.06)" }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:11, fontFamily:"monospace", fontWeight:700, color:"var(--s3)" }}>#{o.id.slice(0,8).toUpperCase()}</p>
                          <p style={{ fontSize:11, color:"var(--s4)", marginTop:1 }}>{o.gateway} · {new Date(o.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <p style={{ fontSize:13, fontWeight:700, color:"#22c55e", flexShrink:0 }}>R$ {o.total.toFixed(2)}</p>
                        <span className="badge" style={{ background:st.bg, color:st.c, flexShrink:0 }}>{st.l}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteEditor({ initial, onSave }: { initial:string; onSave:(s:string)=>void }) {
  const [val, setVal] = useState(initial);
  const [saved, setSaved] = useState(false);
  function save() { onSave(val); setSaved(true); setTimeout(()=>setSaved(false),2000); }
  return (
    <div>
      <textarea className="vi" style={{ height:70, resize:"none", fontSize:12 }} value={val} onChange={e=>setVal(e.target.value)} placeholder="Notas internas sobre este cliente..." />
      <button onClick={save} style={{ marginTop:6, fontSize:11, padding:"5px 12px", borderRadius:7,
        background:saved?"rgba(34,197,94,.1)":"rgba(120,50,255,.12)",
        border:`1px solid ${saved?"rgba(34,197,94,.3)":"rgba(120,50,255,.2)"}`,
        color:saved?"#22c55e":"#a855f7", cursor:"pointer", fontWeight:600,
      }}>{saved?"✓ Salvo":"Salvar nota"}</button>
    </div>
  );
}
