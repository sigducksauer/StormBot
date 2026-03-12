"use client";
import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api/client";

/* ─── Types ─────────────────────────────────────────────────────── */
interface Summary {
  total_orders: number; delivered_orders: number; pending_orders: number;
  gross_revenue: number; net_revenue: number; total_fees: number;
  avg_ticket: number; total_customers: number; refunded_orders: number;
}
interface Day { date: string; gross: number; net: number; orders: number; }
interface TopProduct { id:string; name:string; revenue:number; units_sold:number; }
interface Funnel { created:number; paid:number; delivered:number; refunded:number; conversion_rate:number; }
interface RecentOrder {
  id:string; total:number; status:string;
  customer_username:string; created_at:string;
  gateway:string;
}

const EMPTY: Summary = {
  total_orders:0, delivered_orders:0, pending_orders:0,
  gross_revenue:0, net_revenue:0, total_fees:0,
  avg_ticket:0, total_customers:0, refunded_orders:0,
};

const PERIODS = [
  { v:"7d",  l:"7 dias"  },
  { v:"30d", l:"30 dias" },
  { v:"90d", l:"90 dias" },
  { v:"1y",  l:"1 ano"   },
];

const STATUS_MAP: Record<string,(s:string)=>{ label:string; color:string; bg:string }> = {
  pending:   ()=>({ label:"Pendente",    color:"#f59e0b", bg:"rgba(245,158,11,.12)" }),
  paid:      ()=>({ label:"Pago",        color:"#22c55e", bg:"rgba(34,197,94,.12)"  }),
  delivered: ()=>({ label:"Entregue",    color:"#a855f7", bg:"rgba(168,85,247,.12)" }),
  refunded:  ()=>({ label:"Reembolsado", color:"#64748b", bg:"rgba(100,116,139,.12)" }),
  expired:   ()=>({ label:"Expirado",    color:"#475569", bg:"rgba(71,85,105,.12)"  }),
  failed:    ()=>({ label:"Falhou",      color:"#ef4444", bg:"rgba(239,68,68,.12)"  }),
};
function getStatus(s:string) {
  return STATUS_MAP[s]?.(s) ?? { label:s, color:"var(--s3)", bg:"rgba(255,255,255,.06)" };
}

const T = {
  tooltip: {
    contentStyle:{ background:"#1a1030", border:"1px solid rgba(120,50,255,.25)", borderRadius:10, fontSize:12 },
    labelStyle:{ color:"var(--s3)", marginBottom:4 },
  },
  axis:{ fill:"#4a3d6e", fontSize:11 },
};

/* ─── Custom tooltip ─────────────────────────────────────────────── */
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#1a1030", border:"1px solid rgba(120,50,255,.25)", borderRadius:10, padding:"10px 14px", fontSize:12 }}>
      <p style={{ color:"var(--s3)", marginBottom:6 }}>{label}</p>
      {payload.map((p:any) => (
        <p key={p.name} style={{ color:p.color, fontWeight:600 }}>
          {p.name === "orders" ? `${p.value} pedidos` : `R$ ${Number(p.value).toFixed(2)} — ${p.name === "gross" ? "Bruto" : "Líquido"}`}
        </p>
      ))}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export function Dashboard({ serverId }: { serverId: string }) {
  const [period,   setPeriod]   = useState("30d");
  const [summary,  setSummary]  = useState<Summary>(EMPTY);
  const [days,     setDays]     = useState<Day[]>([]);
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [funnel,   setFunnel]   = useState<Funnel|null>(null);
  const [recent,   setRecent]   = useState<RecentOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState(false);

  const load = useCallback(() => {
    setLoading(true); setErr(false);
    Promise.all([
      api.get<Summary>(`/analytics/summary?period=${period}`, serverId).catch(()=>EMPTY),
      api.get<{data:Day[]}>(`/analytics/revenue/daily?period=${period}`, serverId).catch(()=>({data:[]})),
      api.get<{products:TopProduct[]}>(`/analytics/products/top?period=${period}&limit=5`, serverId).catch(()=>({products:[]})),
      api.get<Funnel>(`/analytics/funnel?period=${period}`, serverId).catch(()=>null),
      api.get<{orders:RecentOrder[]}>(`/orders?limit=8&sort=created_at:desc`, serverId).catch(()=>({orders:[]})),
    ]).then(([s,r,p,f,o]) => {
      setSummary(s ?? EMPTY);
      setDays((r as any)?.data ?? []);
      setProducts((p as any)?.products ?? []);
      setFunnel(f as Funnel | null);
      setRecent((o as any)?.orders ?? []);
    }).catch(()=>setErr(true)).finally(()=>setLoading(false));
  }, [period, serverId]);

  useEffect(() => { load(); }, [load]);

  const convRate = funnel?.conversion_rate ?? 0;

  return (
    <div className="fu" style={{ display:"flex", flexDirection:"column", gap:24 }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Dashboard</h1>
          <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>Visão geral do seu negócio</p>
        </div>
        <div style={{ display:"flex", gap:4, background:"rgba(10,7,22,0.8)", border:"1px solid var(--border)", borderRadius:10, padding:4 }}>
          {PERIODS.map(p => (
            <button key={p.v} onClick={()=>setPeriod(p.v)} style={{
              padding:"6px 14px", borderRadius:7, border:"none", cursor:"pointer", fontSize:13, fontWeight:600,
              background: period===p.v ? "rgba(124,58,237,0.25)" : "transparent",
              color: period===p.v ? "#c8bfe8" : "var(--s4)",
              transition:"all .15s",
            }}>{p.l}</button>
          ))}
        </div>
      </div>

      {err && (
        <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.2)", color:"#ef4444", fontSize:13 }}>
          Erro ao carregar dados. Verifique se a API está rodando.
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:14 }}>
        {[
          { label:"Receita Bruta",    val:`R$ ${summary.gross_revenue.toFixed(2)}`,  accent:"#22c55e" },
          { label:"Receita Líquida",  val:`R$ ${summary.net_revenue.toFixed(2)}`,    accent:"#a855f7" },
          { label:"Total Pedidos",    val:String(summary.total_orders),              accent:"#60a5fa" },
          { label:"Entregues",        val:String(summary.delivered_orders),          accent:"#a855f7" },
          { label:"Pendentes",        val:String(summary.pending_orders),            accent:"#f59e0b" },
          { label:"Reembolsados",     val:String(summary.refunded_orders),           accent:"#f87171" },
          { label:"Ticket Médio",     val:`R$ ${summary.avg_ticket.toFixed(2)}`,     accent:"#38bdf8" },
          { label:"Clientes Únicos",  val:String(summary.total_customers),           accent:"#34d399" },
          { label:"Taxas Cobradas",   val:`R$ ${summary.total_fees.toFixed(2)}`,     accent:"#fb923c" },
          { label:"Conversão",        val:`${convRate}%`,                            accent: convRate>=50?"#22c55e":convRate>=25?"#f59e0b":"#ef4444" },
        ].map(({ label, val, accent }) => (
          <StatCard key={label} label={label} val={val} accent={accent} loading={loading} />
        ))}
      </div>

      {/* ── Revenue chart ── */}
      <div className="vcard" style={{ padding:24 }}>
        <h3 style={{ fontSize:15, fontWeight:700, color:"var(--s1)", marginBottom:20 }}>Receita por dia</h3>
        {loading ? (
          <div style={{ height:220, background:"rgba(120,50,255,.06)", borderRadius:10 }} />
        ) : days.length===0 ? (
          <div style={{ height:220, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--s4)", fontSize:14 }}>
            Sem dados para o período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={days} margin={{ top:4, right:8, bottom:0, left:0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(120,50,255,.1)" vertical={false} />
              <XAxis dataKey="date" tick={T.axis} axisLine={false} tickLine={false} />
              <YAxis tick={T.axis} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v}`} width={62} />
              <Tooltip content={<RevenueTooltip />} />
              <Line dataKey="gross" stroke="#7c3aed" strokeWidth={2.5} dot={false} name="gross" />
              <Line dataKey="net"   stroke="#22c55e" strokeWidth={2.5} dot={false} name="net"   />
            </LineChart>
          </ResponsiveContainer>
        )}
        <div style={{ display:"flex", gap:20, marginTop:14 }}>
          {[["#7c3aed","Receita Bruta"],["#22c55e","Receita Líquida"]].map(([c,l])=>(
            <div key={l} style={{ display:"flex", alignItems:"center", gap:7 }}>
              <div style={{ width:24, height:3, borderRadius:2, background:c }} />
              <span style={{ fontSize:12, color:"var(--s3)" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:18 }}>

        {/* Top products */}
        <div className="vcard" style={{ padding:24 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:"var(--s1)", marginBottom:20 }}>Produtos mais vendidos</h3>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[1,2,3].map(i=><div key={i} style={{ height:40, background:"rgba(120,50,255,.06)", borderRadius:8 }} />)}
            </div>
          ) : products.length===0 ? (
            <p style={{ color:"var(--s4)", fontSize:13, textAlign:"center", padding:"32px 0" }}>Sem vendas no período</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {products.map((p,i)=>{
                const pct = products[0] ? (p.revenue/products[0].revenue)*100 : 0;
                const medals = ["#f59e0b","#94a3b8","#c2773a","var(--s4)","var(--s4)"];
                return (
                  <div key={p.id}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{
                          width:22, height:22, borderRadius:"50%", display:"flex",
                          alignItems:"center", justifyContent:"center",
                          fontSize:11, fontWeight:700, flexShrink:0,
                          background:`${medals[i]}20`, color:medals[i],
                        }}>{i+1}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:"var(--s1)" }}>{p.name}</span>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <p style={{ fontSize:13, fontWeight:700, color:"#22c55e" }}>R$ {p.revenue.toFixed(2)}</p>
                        <p style={{ fontSize:11, color:"var(--s4)" }}>{p.units_sold} vendas</p>
                      </div>
                    </div>
                    <div style={{ height:4, background:"rgba(120,50,255,.12)", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#7c3aed,#a855f7)", borderRadius:3, transition:"width .6s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Funnel */}
        <div className="vcard" style={{ padding:24 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:"var(--s1)", marginBottom:20 }}>Funil de conversão</h3>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[1,2,3,4].map(i=><div key={i} style={{ height:36, background:"rgba(120,50,255,.06)", borderRadius:8 }} />)}
            </div>
          ) : !funnel ? (
            <p style={{ color:"var(--s4)", fontSize:13, textAlign:"center", padding:"32px 0" }}>Sem dados no período</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                { label:"Criados",    val:funnel.created,   color:"#60a5fa", pct:100 },
                { label:"Pagos",      val:funnel.paid,      color:"#22c55e", pct:funnel.created>0?(funnel.paid/funnel.created)*100:0 },
                { label:"Entregues",  val:funnel.delivered, color:"#a855f7", pct:funnel.created>0?(funnel.delivered/funnel.created)*100:0 },
                { label:"Reembolsos", val:funnel.refunded,  color:"#ef4444", pct:funnel.created>0?(funnel.refunded/funnel.created)*100:0 },
              ].map(row=>(
                <div key={row.label}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:12, color:"var(--s3)" }}>{row.label}</span>
                    <div style={{ display:"flex", gap:10 }}>
                      <span style={{ fontSize:12, color:"var(--s4)" }}>{row.pct.toFixed(0)}%</span>
                      <span style={{ fontSize:12, fontWeight:700, color:"var(--s1)" }}>{row.val}</span>
                    </div>
                  </div>
                  <div style={{ height:6, background:"rgba(255,255,255,.05)", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${row.pct}%`, background:row.color, borderRadius:4, transition:"width .6s ease" }} />
                  </div>
                </div>
              ))}
              <div style={{ borderTop:"1px solid var(--border)", paddingTop:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:13, color:"var(--s3)" }}>Taxa de conversão</span>
                <span style={{
                  fontSize:22, fontWeight:800,
                  color: convRate>=50?"#22c55e":convRate>=25?"#f59e0b":"#ef4444",
                }}>{convRate}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Orders bar chart */}
        <div className="vcard" style={{ padding:24 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:"var(--s1)", marginBottom:20 }}>Pedidos por dia</h3>
          {loading ? (
            <div style={{ height:180, background:"rgba(120,50,255,.06)", borderRadius:10 }} />
          ) : days.length===0 ? (
            <p style={{ color:"var(--s4)", fontSize:13, textAlign:"center", padding:"32px 0" }}>Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={days} margin={{ top:4, right:8, bottom:0, left:0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(120,50,255,.1)" vertical={false} />
                <XAxis dataKey="date" tick={T.axis} axisLine={false} tickLine={false} />
                <YAxis tick={T.axis} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={T.tooltip.contentStyle} labelStyle={T.tooltip.labelStyle} cursor={{ fill:"rgba(124,58,237,.08)" }} />
                <Bar dataKey="orders" fill="#7c3aed" radius={[4,4,0,0]} name="Pedidos" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent orders */}
        <div className="vcard" style={{ padding:24 }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:"var(--s1)", marginBottom:18 }}>Pedidos recentes</h3>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[1,2,3,4,5].map(i=><div key={i} style={{ height:38, background:"rgba(120,50,255,.06)", borderRadius:8 }} />)}
            </div>
          ) : recent.length===0 ? (
            <p style={{ color:"var(--s4)", fontSize:13, textAlign:"center", padding:"32px 0" }}>Nenhum pedido ainda</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {recent.map((o,idx)=>{
                const st = getStatus(o.status);
                return (
                  <div key={o.id} style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"10px 0",
                    borderBottom: idx<recent.length-1 ? "1px solid rgba(120,50,255,.08)" : "none",
                  }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:700, color:"var(--s1)", fontFamily:"monospace" }}>
                        #{o.id.slice(0,8).toUpperCase()}
                      </p>
                      <p style={{ fontSize:11, color:"var(--s4)", marginTop:1 }}>{o.customer_username}</p>
                    </div>
                    <p style={{ fontSize:13, fontWeight:700, color:"#22c55e", flexShrink:0 }}>
                      R$ {o.total.toFixed(2)}
                    </p>
                    <span className="badge" style={{ background:st.bg, color:st.color, flexShrink:0 }}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ─── Stat card ─────────────────────────────────────────────────── */
function StatCard({ label, val, accent, loading }: { label:string; val:string; accent:string; loading:boolean }) {
  return (
    <div className="vcard" style={{ padding:"18px 20px" }}>
      {loading ? (
        <div>
          <div style={{ height:10, width:"60%", background:"rgba(120,50,255,.1)", borderRadius:5, marginBottom:12 }} />
          <div style={{ height:24, width:"80%", background:"rgba(120,50,255,.1)", borderRadius:5 }} />
        </div>
      ) : (
        <>
          <p style={{ fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", marginBottom:10 }}>
            {label}
          </p>
          <p style={{ fontSize:22, fontWeight:800, color:accent, fontFamily:"Syne,sans-serif" }}>{val}</p>
        </>
      )}
    </div>
  );
}
