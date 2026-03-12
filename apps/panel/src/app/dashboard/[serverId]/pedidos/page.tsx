"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Order {
  id:string; status:string; total:number; fee_amount:number; net_amount:number;
  gateway:string; payment_method:string; created_at:string; paid_at:string|null;
  customer_username:string; customer_discord_id:string;
}

const STATUS_MAP: Record<string,{ label:string; color:string; bg:string }> = {
  pending:   { label:"Pendente",    color:"#f59e0b", bg:"rgba(245,158,11,.12)" },
  paid:      { label:"Pago",        color:"#22c55e", bg:"rgba(34,197,94,.12)"  },
  delivered: { label:"Entregue",    color:"#a855f7", bg:"rgba(168,85,247,.12)" },
  refunded:  { label:"Reembolsado", color:"#64748b", bg:"rgba(100,116,139,.12)"},
  expired:   { label:"Expirado",    color:"#475569", bg:"rgba(71,85,105,.12)"  },
  failed:    { label:"Falhou",      color:"#ef4444", bg:"rgba(239,68,68,.12)"  },
};

const FILTERS = ["", "pending","paid","delivered","refunded","expired","failed"];
const LIMIT = 20;

export default function PedidosPage() {
  const { serverId } = useParams() as { serverId:string };
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");
  const [page,    setPage]    = useState(0);
  const [msg,     setMsg]     = useState("");
  const [search,  setSearch]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/orders?limit=${LIMIT}&offset=${page*LIMIT}${filter?`&status=${filter}`:""}${search?`&search=${encodeURIComponent(search)}`:""}`;
      const d = await api.get<{orders:Order[]; total:number}>(url, serverId);
      setOrders(d.orders||[]); setTotal(d.total||0);
    } catch { setOrders([]); setTotal(0); } finally { setLoading(false); }
  }, [serverId, filter, page, search]);

  useEffect(() => { load(); }, [load]);

  async function action(id:string, type:"refund"|"deliver") {
    try {
      await api.post(`/orders/${id}/${type}`, {}, serverId);
      setMsg(type==="refund"?"✅ Reembolso processado.":"✅ Entregue!");
      load();
    } catch (err:any) { setMsg("❌ " + (err?.message||"Erro")); }
    setTimeout(()=>setMsg(""), 4000);
  }

  const totalPages = Math.ceil(total/LIMIT);

  return (
    <div className="fu">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Pedidos</h1>
          <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>{total} pedidos no total</p>
        </div>
        <input className="vi" style={{ width:240 }} placeholder="Buscar por cliente ou ID..." value={search}
          onChange={e=>{ setSearch(e.target.value); setPage(0); }} />
      </div>

      {msg && (
        <div style={{ marginBottom:16, padding:"9px 14px", borderRadius:10, fontSize:13,
          background:msg.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
          border:`1px solid ${msg.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
          color:msg.startsWith("✅")?"#22c55e":"#ef4444",
        }}>{msg}</div>
      )}

      {/* Status filters */}
      <div style={{ display:"flex", gap:6, marginBottom:18, flexWrap:"wrap" }}>
        {FILTERS.map(f=>{
          const st = STATUS_MAP[f];
          return (
            <button key={f} onClick={()=>{ setFilter(f); setPage(0); }} style={{
              padding:"5px 14px", borderRadius:100, border:"1px solid", cursor:"pointer", fontSize:12, fontWeight:600,
              background: filter===f ? (f?"":"rgba(124,58,237,.18)") : "transparent",
              borderColor: filter===f ? (f?st.color:"#a855f7") : "var(--border)",
              color: filter===f ? (f?st.color:"#a855f7") : "var(--s4)",
              transition:"all .15s",
            }}>
              {f===""?"Todos":st.label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="vcard" style={{ overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Pedido","Cliente","Valor","Taxa","Líquido","Gateway","Status","Data","Ações"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"12px 16px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:6}).map((_,i)=>(
                  <tr key={i}>
                    {Array.from({length:9}).map((_,j)=>(
                      <td key={j} style={{ padding:"14px 16px" }}>
                        <div style={{ height:12, background:"rgba(120,50,255,.08)", borderRadius:4 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length===0 ? (
                <tr><td colSpan={9} style={{ textAlign:"center", padding:"64px 20px", color:"var(--s4)", fontSize:14 }}>
                  Nenhum pedido encontrado
                </td></tr>
              ) : orders.map(o=>{
                const st = STATUS_MAP[o.status] ?? { label:o.status, color:"var(--s3)", bg:"transparent" };
                return (
                  <tr key={o.id} style={{ borderBottom:"1px solid rgba(120,50,255,.06)", transition:"background .12s" }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="rgba(120,50,255,.04)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}
                  >
                    <td style={{ padding:"12px 16px", fontFamily:"monospace", fontSize:12, fontWeight:700, color:"var(--s3)" }}>
                      #{o.id.slice(0,8).toUpperCase()}
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:12, color:"var(--s2)" }}>{o.customer_username||"—"}</td>
                    <td style={{ padding:"12px 16px", fontSize:13, fontWeight:700, color:"#22c55e" }}>R$ {o.total?.toFixed(2)}</td>
                    <td style={{ padding:"12px 16px", fontSize:12, color:"#f87171" }}>−{o.fee_amount?.toFixed(2)}</td>
                    <td style={{ padding:"12px 16px", fontSize:12, fontWeight:600, color:"#60a5fa" }}>R$ {o.net_amount?.toFixed(2)}</td>
                    <td style={{ padding:"12px 16px", fontSize:12, color:"var(--s4)", textTransform:"capitalize" }}>{o.gateway||"—"}</td>
                    <td style={{ padding:"12px 16px" }}>
                      <span className="badge" style={{ background:st.bg, color:st.color }}>
                        <span style={{ width:5, height:5, borderRadius:"50%", background:st.color, flexShrink:0 }} />
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:11, color:"var(--s4)", whiteSpace:"nowrap" }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex", gap:6 }}>
                        {o.status==="paid" && (
                          <button onClick={()=>action(o.id,"deliver")} style={{
                            fontSize:11, padding:"4px 10px", borderRadius:7, border:"1px solid rgba(168,85,247,.3)",
                            background:"rgba(168,85,247,.08)", color:"#a855f7", cursor:"pointer",
                          }}>Entregar</button>
                        )}
                        {(o.status==="paid"||o.status==="delivered") && (
                          <button onClick={()=>{ if(confirm("Reembolsar?")) action(o.id,"refund"); }} style={{
                            fontSize:11, padding:"4px 10px", borderRadius:7, border:"1px solid rgba(239,68,68,.3)",
                            background:"rgba(239,68,68,.08)", color:"#ef4444", cursor:"pointer",
                          }}>Reembolsar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages>1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:16 }}>
          <p style={{ fontSize:13, color:"var(--s4)" }}>
            {page*LIMIT+1}–{Math.min((page+1)*LIMIT,total)} de {total}
          </p>
          <div style={{ display:"flex", gap:6 }}>
            <button className="vbg" style={{ padding:"7px 16px", fontSize:13 }} disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Anterior</button>
            <span style={{ display:"flex", alignItems:"center", padding:"7px 16px", fontSize:13, color:"var(--s3)" }}>{page+1}/{totalPages}</span>
            <button className="vbg" style={{ padding:"7px 16px", fontSize:13 }} disabled={page+1>=totalPages} onClick={()=>setPage(p=>p+1)}>Próxima →</button>
          </div>
        </div>
      )}
    </div>
  );
}
