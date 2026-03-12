"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Log { id:string; action:string; resource:string|null; resource_id:string|null; changes:any; ip_address:string|null; created_at:string; user_id:string|null }

const ACTION_MAP: Record<string,{color:string;icon:string;label:string}> = {
  "order.created":     {color:"#60a5fa", icon:"◉", label:"Pedido criado"},
  "order.paid":        {color:"#22c55e", icon:"◈", label:"Pagamento confirmado"},
  "order.delivered":   {color:"#a855f7", icon:"◇", label:"Pedido entregue"},
  "order.refunded":    {color:"#f87171", icon:"◎", label:"Reembolso"},
  "order.chargeback":  {color:"#ef4444", icon:"⬡", label:"Chargeback"},
  "order.expired":     {color:"#64748b", icon:"◬", label:"Pedido expirado"},
  "product.created":   {color:"#34d399", icon:"◈", label:"Produto criado"},
  "product.updated":   {color:"#6ee7b7", icon:"◈", label:"Produto atualizado"},
  "product.deleted":   {color:"#f87171", icon:"◈", label:"Produto excluído"},
  "payment.confirmed": {color:"#22c55e", icon:"◇", label:"Pagamento confirmado"},
  "payment.failed":    {color:"#ef4444", icon:"◇", label:"Pagamento falhou"},
  "auth.login_panel":  {color:"#94a3b8", icon:"▦",  label:"Login no painel"},
  "settings.updated":  {color:"#f59e0b", icon:"◬", label:"Configurações alteradas"},
  "gateway.updated":   {color:"#fb923c", icon:"◇", label:"Gateway atualizado"},
  "coupon.created":    {color:"#34d399", icon:"⬡", label:"Cupom criado"},
  "coupon.deleted":    {color:"#f87171", icon:"⬡", label:"Cupom excluído"},
  "team.invited":      {color:"#a855f7", icon:"◈", label:"Membro convidado"},
  "team.removed":      {color:"#f87171", icon:"◈", label:"Membro removido"},
  "customer.blacklisted":{color:"#ef4444", icon:"◎", label:"Cliente bloqueado"},
};

const FILTER_GROUPS = [
  { l:"Todos",    v:"" },
  { l:"Pedidos",  v:"order." },
  { l:"Produtos", v:"product." },
  { l:"Pagamentos",v:"payment." },
  { l:"Config",   v:"settings." },
  { l:"Equipe",   v:"team." },
];

export default function AuditPage() {
  const { serverId } = useParams() as { serverId:string };
  const [logs,    setLogs]    = useState<Log[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");
  const [page,    setPage]    = useState(0);
  const [expanded, setExpanded] = useState<string|null>(null);
  const LIMIT = 30;

  useEffect(() => { load(); }, [serverId, filter, page]);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get<{logs:Log[];total:number}>(`/audit?limit=${LIMIT}&offset=${page*LIMIT}${filter?`&action_prefix=${encodeURIComponent(filter)}`:""}`, serverId);
      setLogs(d.logs||[]); setTotal(d.total||0);
    } catch { setLogs([]); setTotal(0); } finally { setLoading(false); }
  }

  function getInfo(action:string) {
    return ACTION_MAP[action] || { color:"var(--s3)", icon:"◈", label:action };
  }

  const totalPages = Math.ceil(total/LIMIT);

  return (
    <div className="fu">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Logs de Auditoria</h1>
          <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>{total} eventos registrados</p>
        </div>
        <div style={{ display:"flex", gap:4, background:"rgba(10,7,22,.8)", border:"1px solid var(--border)", borderRadius:10, padding:4 }}>
          {FILTER_GROUPS.map(f=>(
            <button key={f.v} onClick={()=>{ setFilter(f.v); setPage(0); }} style={{
              padding:"5px 12px", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600,
              background:filter===f.v?"rgba(124,58,237,.25)":"transparent",
              color:filter===f.v?"#c8bfe8":"var(--s4)",
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      <div className="vcard" style={{ overflow:"hidden" }}>
        {loading ? (
          Array.from({length:10}).map((_,i)=>(
            <div key={i} style={{ padding:"14px 20px", borderBottom:"1px solid rgba(120,50,255,.06)", display:"flex", gap:14, alignItems:"center" }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(120,50,255,.08)", flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ height:12, width:"40%", background:"rgba(120,50,255,.06)", borderRadius:4, marginBottom:6 }} />
                <div style={{ height:10, width:"25%", background:"rgba(120,50,255,.04)", borderRadius:4 }} />
              </div>
              <div style={{ height:10, width:"15%", background:"rgba(120,50,255,.04)", borderRadius:4 }} />
            </div>
          ))
        ) : logs.length===0 ? (
          <div style={{ textAlign:"center", padding:"64px 20px", color:"var(--s4)", fontSize:14 }}>Nenhum evento encontrado</div>
        ) : logs.map(log=>{
          const info = getInfo(log.action);
          const hasChanges = log.changes && Object.keys(log.changes).length > 0;
          return (
            <div key={log.id}>
              <div
                style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 20px", borderBottom:"1px solid rgba(120,50,255,.05)", cursor:hasChanges?"pointer":"default", transition:"background .12s" }}
                onClick={()=>hasChanges && setExpanded(expanded===log.id?null:log.id)}
                onMouseEnter={e=>{ if(hasChanges)(e.currentTarget as any).style.background="rgba(120,50,255,.04)"; }}
                onMouseLeave={e=>(e.currentTarget as any).style.background="transparent"}
              >
                <div style={{
                  width:32, height:32, borderRadius:"50%", flexShrink:0,
                  background:`${info.color}18`, border:`1px solid ${info.color}30`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, color:info.color,
                }}>{info.icon}</div>

                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:600, color:"var(--s1)" }}>{info.label}</p>
                  <div style={{ display:"flex", gap:12, marginTop:3 }}>
                    {log.resource && <span style={{ fontSize:11, color:"var(--s4)" }}>{log.resource}{log.resource_id && ` #${log.resource_id.slice(0,8).toUpperCase()}`}</span>}
                    {log.ip_address && <span style={{ fontSize:11, color:"var(--s4)", fontFamily:"monospace" }}>{log.ip_address}</span>}
                  </div>
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
                  <span style={{ fontSize:12, color:"var(--s4)", whiteSpace:"nowrap" }}>{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                  {hasChanges && <span style={{ fontSize:12, color:"var(--s4)" }}>{expanded===log.id?"▲":"▼"}</span>}
                </div>
              </div>

              {expanded===log.id && hasChanges && (
                <div style={{ padding:"12px 20px 16px 66px", borderBottom:"1px solid rgba(120,50,255,.06)", background:"rgba(120,50,255,.03)" }}>
                  <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", color:"var(--s4)", marginBottom:8 }}>Alterações</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {Object.entries(log.changes).map(([k,v]:any)=>(
                      <div key={k} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                        <code style={{ fontSize:11, color:"#a855f7", minWidth:140, flexShrink:0 }}>{k}</code>
                        <code style={{ fontSize:11, color:"var(--s3)", wordBreak:"break-all" }}>{JSON.stringify(v)}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14 }}>
          <p style={{ fontSize:13, color:"var(--s4)" }}>{page*LIMIT+1}–{Math.min((page+1)*LIMIT,total)} de {total}</p>
          <div style={{ display:"flex", gap:6 }}>
            <button className="vbg" style={{ padding:"7px 14px", fontSize:13 }} disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Anterior</button>
            <span style={{ padding:"7px 14px", fontSize:13, color:"var(--s3)" }}>{page+1}/{totalPages}</span>
            <button className="vbg" style={{ padding:"7px 14px", fontSize:13 }} disabled={page+1>=totalPages} onClick={()=>setPage(p=>p+1)}>Próxima →</button>
          </div>
        </div>
      )}
    </div>
  );
}
