"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Coupon {
  id:string; code:string; discount_type:string; discount_value:number;
  min_purchase:number; max_uses:number; used_count:number;
  is_active:boolean; expires_at:string|null;
}
const EMPTY = { code:"", discount_type:"percent", discount_value:"10", min_purchase:"0", max_uses:"-1", expires_at:"" };

export default function CuponsPage() {
  const { serverId } = useParams() as { serverId:string };
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");

  useEffect(()=>{ load(); },[serverId]);

  async function load() {
    setLoading(true);
    try { setCoupons(await api.get<Coupon[]>("/coupons", serverId)); }
    catch { setCoupons([]); } finally { setLoading(false); }
  }

  async function create(e:React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post("/coupons", { ...form, discount_value:Number(form.discount_value),
        min_purchase:Number(form.min_purchase), max_uses:Number(form.max_uses), expires_at:form.expires_at||null }, serverId);
      toast("Cupom criado!"); setOpen(false); setForm(EMPTY); load();
    } catch(err:any) { toast(err?.message||"Erro",true); }
    finally { setSaving(false); }
  }

  async function toggle(c:Coupon) {
    await api.patch(`/coupons/${c.id}/toggle`,{},serverId).catch(()=>{}); load();
  }
  async function remove(c:Coupon) {
    if(!confirm(`Excluir ${c.code}?`)) return;
    await api.delete(`/coupons/${c.id}`,serverId).catch(()=>{}); load();
  }

  function toast(m:string,err=false) { setMsg((err?"❌ ":"✅ ")+m); setTimeout(()=>setMsg(""),3000); }

  return (
    <div className="fu">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Cupons</h1>
          <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>Crie promoções com desconto para seus clientes</p>
        </div>
        <button className="vbp" onClick={()=>setOpen(true)}>+ Novo Cupom</button>
      </div>
      {msg && <Msg text={msg} />}

      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[1,2,3].map(i=><div key={i} style={{ height:62, borderRadius:12, background:"rgba(120,50,255,.06)" }} />)}
        </div>
      ) : coupons.length===0 ? (
        <div className="vcard" style={{ textAlign:"center", padding:"64px 20px" }}>
          <div style={{ fontSize:40, marginBottom:14 }}>⬡</div>
          <p style={{ fontSize:16, fontWeight:700, color:"var(--s2)", marginBottom:8 }}>Nenhum cupom criado</p>
          <p style={{ fontSize:13, color:"var(--s4)", marginBottom:24 }}>Crie promoções para aumentar suas conversões</p>
          <button className="vbp" onClick={()=>setOpen(true)}>+ Criar Cupom</button>
        </div>
      ) : (
        <div className="vcard" style={{ overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Código","Desconto","Mínimo","Usos","Validade","Status",""].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"11px 16px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map(c=>(
                <tr key={c.id} style={{ borderBottom:"1px solid rgba(120,50,255,.06)" }}>
                  <td style={{ padding:"12px 16px", fontFamily:"monospace", fontSize:13, fontWeight:700, color:"var(--s1)" }}>{c.code}</td>
                  <td style={{ padding:"12px 16px", fontSize:13, fontWeight:700, color:"#22c55e" }}>
                    {c.discount_type==="percent" ? `${c.discount_value}%` : `R$ ${c.discount_value.toFixed(2)}`}
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:13, color:"var(--s3)" }}>R$ {c.min_purchase.toFixed(2)}</td>
                  <td style={{ padding:"12px 16px", fontSize:13, color:"var(--s3)" }}>
                    <span style={{ color: c.max_uses!==-1&&c.used_count>=c.max_uses?"#ef4444":"var(--s3)" }}>
                      {c.used_count}/{c.max_uses===-1?"∞":c.max_uses}
                    </span>
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:12, color:"var(--s4)" }}>
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-BR") : "Sem limite"}
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <span className="badge" style={{ background:c.is_active?"rgba(34,197,94,.12)":"rgba(71,85,105,.1)", color:c.is_active?"#22c55e":"var(--s4)" }}>
                      {c.is_active?"Ativo":"Inativo"}
                    </span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>toggle(c)} style={{ fontSize:11, padding:"4px 10px", borderRadius:7, border:"1px solid var(--border)", background:"transparent", color:"var(--s3)", cursor:"pointer" }}>
                        {c.is_active?"Pausar":"Ativar"}
                      </button>
                      <button onClick={()=>remove(c)} style={{ fontSize:11, padding:"4px 10px", borderRadius:7, border:"1px solid rgba(239,68,68,.3)", background:"rgba(239,68,68,.08)", color:"#ef4444", cursor:"pointer" }}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal title="Novo Cupom" onClose={()=>setOpen(false)}>
          <form onSubmit={create} style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Fld label="Código *">
              <input className="vi" style={{ textTransform:"uppercase", fontFamily:"monospace" }} value={form.code}
                onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="PROMO20" required />
            </Fld>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Fld label="Tipo">
                <select className="vi" value={form.discount_type} onChange={e=>setForm(f=>({...f,discount_type:e.target.value}))}>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
              </Fld>
              <Fld label="Valor *">
                <input type="number" min="0.01" step="0.01" className="vi" value={form.discount_value}
                  onChange={e=>setForm(f=>({...f,discount_value:e.target.value}))} required />
              </Fld>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Fld label="Compra mínima (R$)">
                <input type="number" min="0" className="vi" value={form.min_purchase}
                  onChange={e=>setForm(f=>({...f,min_purchase:e.target.value}))} />
              </Fld>
              <Fld label="Máx. usos (-1=∞)">
                <input type="number" min="-1" className="vi" value={form.max_uses}
                  onChange={e=>setForm(f=>({...f,max_uses:e.target.value}))} />
              </Fld>
            </div>
            <Fld label="Expira em (opcional)">
              <input type="datetime-local" className="vi" value={form.expires_at}
                onChange={e=>setForm(f=>({...f,expires_at:e.target.value}))} />
            </Fld>
            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              <button type="button" className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={()=>setOpen(false)}>Cancelar</button>
              <button type="submit" className="vbp" style={{ flex:1, justifyContent:"center" }} disabled={saving}>{saving?"Criando...":"Criar Cupom"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Fld({label,children}:{label:string;children:React.ReactNode}) {
  return <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--s4)",display:"block",marginBottom:6}}>{label}</label>{children}</div>;
}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,width:"100%",maxWidth:460,boxShadow:"0 24px 64px rgba(0,0,0,.5)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px 16px",borderBottom:"1px solid var(--border)"}}>
          <h2 style={{fontSize:16,fontWeight:700,color:"var(--s1)"}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"var(--s4)",fontSize:20}}>✕</button>
        </div>
        <div style={{padding:"20px 24px 24px"}}>{children}</div>
      </div>
    </div>
  );
}
function Msg({text}:{text:string}) {
  return <div style={{marginBottom:16,padding:"9px 14px",borderRadius:10,fontSize:13,
    background:text.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
    border:`1px solid ${text.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
    color:text.startsWith("✅")?"#22c55e":"#ef4444"}}>{text}</div>;
}
