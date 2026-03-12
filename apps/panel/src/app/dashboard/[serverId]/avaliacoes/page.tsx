"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Review {
  id:string; product_id:string; customer_id:string; rating:number;
  comment:string|null; is_visible:boolean; created_at:string;
  product_name?:string; customer_username?:string;
}

export default function AvaliacoesPage() {
  const { serverId } = useParams() as { serverId:string };
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<number|null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, [serverId]);

  async function load() {
    setLoading(true);
    try { setReviews(await api.get<Review[]>("/reviews", serverId)); }
    catch { setReviews([]); } finally { setLoading(false); }
  }

  async function toggle(r: Review) {
    await api.patch(`/reviews/${r.id}`, { is_visible:!r.is_visible }, serverId).catch(()=>{});
    setReviews(rv=>rv.map(x=>x.id===r.id?{...x,is_visible:!x.is_visible}:x));
  }

  function toast(m:string) { setMsg(m); setTimeout(()=>setMsg(""),3000); }

  const filtered = filter ? reviews.filter(r=>r.rating===filter) : reviews;
  const avgRating = reviews.length ? reviews.reduce((s,r)=>s+r.rating,0)/reviews.length : 0;
  const dist = [5,4,3,2,1].map(n=>({ n, count:reviews.filter(r=>r.rating===n).length }));

  function Stars({ n, size=14 }: { n:number; size?:number }) {
    return (
      <span style={{ color:"#f59e0b", fontSize:size }}>
        {"★".repeat(n)}{"☆".repeat(5-n)}
      </span>
    );
  }

  return (
    <div className="fu">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Avaliações</h1>
        <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>Feedback dos seus clientes</p>
        {msg && <div style={{ marginTop:10, padding:"8px 14px", borderRadius:10, fontSize:13, display:"inline-block", background:"rgba(34,197,94,.1)", border:"1px solid rgba(34,197,94,.2)", color:"#22c55e" }}>{msg}</div>}
      </div>

      {!loading && reviews.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:20, marginBottom:24 }}>
          {/* Score */}
          <div className="vcard" style={{ padding:"24px 28px", textAlign:"center", minWidth:160 }}>
            <p style={{ fontSize:52, fontWeight:800, color:"#f59e0b", lineHeight:1 }}>{avgRating.toFixed(1)}</p>
            <Stars n={Math.round(avgRating)} size={18} />
            <p style={{ fontSize:12, color:"var(--s4)", marginTop:8 }}>{reviews.length} avaliações</p>
          </div>

          {/* Distribution */}
          <div className="vcard" style={{ padding:"20px 24px" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {dist.map(d=>(
                <div key={d.n} style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer" }} onClick={()=>setFilter(filter===d.n?null:d.n)}>
                  <span style={{ fontSize:13, color:"#f59e0b", whiteSpace:"nowrap", width:20 }}>{d.n}★</span>
                  <div style={{ flex:1, height:8, background:"rgba(255,255,255,.06)", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${reviews.length?d.count/reviews.length*100:0}%`, background:filter===d.n?"#f59e0b":"rgba(245,158,11,.5)", borderRadius:4, transition:"width .5s ease" }} />
                  </div>
                  <span style={{ fontSize:12, color:"var(--s4)", width:24, textAlign:"right" }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter pills */}
      {reviews.length > 0 && (
        <div style={{ display:"flex", gap:6, marginBottom:16 }}>
          <button onClick={()=>setFilter(null)} style={{ padding:"5px 14px", borderRadius:100, border:`1px solid ${!filter?"rgba(168,85,247,.5)":"var(--border)"}`, background:!filter?"rgba(124,58,237,.18)":"transparent", color:!filter?"#c8bfe8":"var(--s4)", fontSize:12, fontWeight:600, cursor:"pointer" }}>Todas</button>
          {[5,4,3,2,1].map(n=>(
            <button key={n} onClick={()=>setFilter(filter===n?null:n)} style={{ padding:"5px 12px", borderRadius:100, border:`1px solid ${filter===n?"#f59e0b44":"var(--border)"}`, background:filter===n?"rgba(245,158,11,.12)":"transparent", color:filter===n?"#f59e0b":"var(--s4)", fontSize:12, fontWeight:600, cursor:"pointer" }}>{n}★</button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12 }}>
          {[1,2,3,4].map(i=><div key={i} style={{ height:140, borderRadius:12, background:"rgba(120,50,255,.06)" }} />)}
        </div>
      ) : filtered.length===0 ? (
        <div className="vcard" style={{ textAlign:"center", padding:"64px 20px" }}>
          <div style={{ fontSize:36, marginBottom:14 }}>★</div>
          <p style={{ fontSize:16, fontWeight:700, color:"var(--s2)", marginBottom:8 }}>
            {reviews.length===0 ? "Nenhuma avaliação ainda" : "Nenhuma avaliação com este filtro"}
          </p>
          <p style={{ fontSize:13, color:"var(--s4)" }}>
            {reviews.length===0 ? "Clientes avaliam após receber o produto" : "Tente outro filtro de estrelas"}
          </p>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12 }}>
          {filtered.map(r=>(
            <div key={r.id} className="vcard" style={{ padding:"18px 20px", opacity:r.is_visible?1:0.5 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:"var(--s1)", marginBottom:3 }}>{r.customer_username||"Cliente"}</p>
                  <Stars n={r.rating} />
                </div>
                <div style={{ textAlign:"right" }}>
                  {r.product_name && <p style={{ fontSize:11, color:"var(--s4)", marginBottom:3 }}>{r.product_name}</p>}
                  <p style={{ fontSize:11, color:"var(--s4)" }}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
              {r.comment && (
                <p style={{ fontSize:13, color:"var(--s2)", lineHeight:1.6, marginBottom:12 }}>"{r.comment}"</p>
              )}
              <button onClick={()=>toggle(r)} style={{
                width:"100%", padding:"6px 0", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600,
                background:r.is_visible?"rgba(239,68,68,.08)":"rgba(34,197,94,.08)",
                border:`1px solid ${r.is_visible?"rgba(239,68,68,.25)":"rgba(34,197,94,.25)"}`,
                color:r.is_visible?"#ef4444":"#22c55e",
              }}>{r.is_visible?"Ocultar":"Exibir"} avaliação</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
