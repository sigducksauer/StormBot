"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Member { id:string; discord_id:number; username:string; role:string; is_active:boolean; created_at:string }

const ROLES: Record<string,{label:string;color:string;bg:string;desc:string}> = {
  owner:    {label:"Owner",     color:"#f59e0b", bg:"rgba(245,158,11,.12)", desc:"Acesso total ao painel, cobrança e dados"},
  admin:    {label:"Admin",     color:"#a855f7", bg:"rgba(168,85,247,.12)", desc:"Tudo exceto cobrança e exclusão do servidor"},
  support:  {label:"Suporte",   color:"#60a5fa", bg:"rgba(96,165,250,.12)", desc:"Pedidos, clientes e tickets"},
  moderator:{label:"Moderador", color:"#22c55e", bg:"rgba(34,197,94,.12)",  desc:"Somente tickets e logs"},
};

const PERMS = [
  { k:"view_analytics",  l:"Ver analytics",     g:"analytics" },
  { k:"manage_products", l:"Gerenciar produtos", g:"store" },
  { k:"manage_orders",   l:"Gerenciar pedidos",  g:"store" },
  { k:"manage_customers",l:"Ver clientes",       g:"store" },
  { k:"manage_coupons",  l:"Gerenciar cupons",   g:"store" },
  { k:"manage_gateways", l:"Configurar pagamentos",g:"financial" },
  { k:"view_financial",  l:"Ver dados financeiros",g:"financial" },
  { k:"manage_team",     l:"Gerenciar equipe",   g:"admin" },
  { k:"manage_settings", l:"Configurações gerais",g:"admin" },
  { k:"view_audit",      l:"Ver logs de auditoria",g:"admin" },
];

export default function EquipePage() {
  const { serverId } = useParams() as { serverId:string };
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member|null>(null);
  const [form, setForm] = useState({ discord_id:"", username:"", role:"support" });
  const [customPerms, setCustomPerms] = useState<Record<string,boolean>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, [serverId]);

  async function load() {
    setLoading(true);
    try { setMembers(await api.get<Member[]>("/team", serverId)); }
    catch { setMembers([]); } finally { setLoading(false); }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post("/team", { ...form, discord_id:Number(form.discord_id), permissions:customPerms }, serverId);
      toast("Membro convidado!"); setOpen(false); setForm({ discord_id:"", username:"", role:"support" }); setCustomPerms({}); load();
    } catch(err:any) { toast(err?.message||"Erro",true); }
    finally { setSaving(false); }
  }

  async function remove(id:string) {
    if (!confirm("Remover este membro da equipe?")) return;
    await api.delete(`/team/${id}`, serverId).catch(()=>{}); load();
  }

  function toast(m:string,err=false) { setMsg((err?"❌ ":"✅ ")+m); setTimeout(()=>setMsg(""),3000); }

  const groupedPerms = PERMS.reduce((acc,p) => { (acc[p.g]=acc[p.g]||[]).push(p); return acc; }, {} as Record<string,typeof PERMS>);

  return (
    <div className="fu">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Equipe</h1>
          <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>Gerencie quem tem acesso ao painel e suas permissões</p>
        </div>
        <button className="vbp" onClick={()=>{ setEditMember(null); setOpen(true); }}>+ Convidar Membro</button>
      </div>
      {msg && <Msg text={msg} />}

      {/* Role cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12, marginBottom:24 }}>
        {Object.entries(ROLES).map(([k,r])=>(
          <div key={k} className="vcard" style={{ padding:"14px 16px", borderColor:r.bg }}>
            <span className="badge" style={{ background:r.bg, color:r.color, marginBottom:8, display:"inline-flex" }}>{r.label}</span>
            <p style={{ fontSize:12, color:"var(--s3)", lineHeight:1.5 }}>{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Members */}
      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[1,2,3].map(i=><div key={i} style={{ height:62, borderRadius:12, background:"rgba(120,50,255,.06)" }} />)}
        </div>
      ) : members.length===0 ? (
        <div className="vcard" style={{ textAlign:"center", padding:"64px 20px" }}>
          <div style={{ fontSize:36, marginBottom:14 }}>◈</div>
          <p style={{ fontSize:16, fontWeight:700, color:"var(--s2)", marginBottom:8 }}>Nenhum membro na equipe</p>
          <p style={{ fontSize:13, color:"var(--s4)", marginBottom:24 }}>Adicione colaboradores com permissões controladas</p>
          <button className="vbp" onClick={()=>setOpen(true)}>+ Convidar Membro</button>
        </div>
      ) : (
        <div className="vcard" style={{ overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                {["Membro","Discord ID","Cargo","Adicionado","Status",""].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"11px 16px", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m=>{
                const role = ROLES[m.role]||ROLES.support;
                return (
                  <tr key={m.id} style={{ borderBottom:"1px solid rgba(120,50,255,.06)" }}>
                    <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"var(--s1)" }}>{m.username}</td>
                    <td style={{ padding:"12px 16px", fontFamily:"monospace", fontSize:12, color:"var(--s4)" }}>{m.discord_id}</td>
                    <td style={{ padding:"12px 16px" }}>
                      <span className="badge" style={{ background:role.bg, color:role.color }}>{role.label}</span>
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:12, color:"var(--s4)" }}>{new Date(m.created_at).toLocaleDateString("pt-BR")}</td>
                    <td style={{ padding:"12px 16px" }}>
                      <span className="badge" style={{ background:m.is_active?"rgba(34,197,94,.1)":"rgba(71,85,105,.1)", color:m.is_active?"#22c55e":"var(--s4)" }}>
                        {m.is_active?"Ativo":"Inativo"}
                      </span>
                    </td>
                    <td style={{ padding:"12px 16px" }}>
                      <button onClick={()=>remove(m.id)} style={{ fontSize:11, padding:"4px 10px", borderRadius:7, border:"1px solid rgba(239,68,68,.3)", background:"rgba(239,68,68,.08)", color:"#ef4444", cursor:"pointer" }}>Remover</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16, overflowY:"auto" }}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, width:"100%", maxWidth:520, boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid var(--border)" }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:"var(--s1)" }}>Convidar Membro</h2>
              <button onClick={()=>setOpen(false)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--s4)",fontSize:20 }}>✕</button>
            </div>
            <form onSubmit={invite} style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Fld label="Discord ID *">
                  <input type="number" className="vi" value={form.discord_id} onChange={e=>setForm(f=>({...f,discord_id:e.target.value}))} placeholder="123456789012345678" required />
                </Fld>
                <Fld label="Username *">
                  <input className="vi" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="usuario" required />
                </Fld>
              </div>
              <Fld label="Cargo *">
                <select className="vi" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {Object.entries(ROLES).filter(([k])=>k!=="owner").map(([k,r])=>(
                    <option key={k} value={k}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </Fld>

              <div>
                <p style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", marginBottom:12 }}>
                  Permissões personalizadas (opcional)
                </p>
                {Object.entries(groupedPerms).map(([g,perms])=>(
                  <div key={g} style={{ marginBottom:12 }}>
                    <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", color:"var(--s4)", marginBottom:6 }}>{g}</p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                      {perms.map(p=>(
                        <label key={p.k} style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", padding:"7px 10px", borderRadius:8, border:`1px solid ${customPerms[p.k]?"rgba(120,50,255,.3)":"var(--border)"}`, background:customPerms[p.k]?"rgba(120,50,255,.08)":"transparent" }}>
                          <input type="checkbox" checked={customPerms[p.k]||false} onChange={e=>setCustomPerms(cp=>({...cp,[p.k]:e.target.checked}))} style={{ accentColor:"#7c3aed" }} />
                          <span style={{ fontSize:11, color:"var(--s2)" }}>{p.l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={()=>setOpen(false)}>Cancelar</button>
                <button type="submit" className="vbp" style={{ flex:1, justifyContent:"center" }} disabled={saving}>{saving?"Convidando...":"Convidar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Fld({label,children}:{label:string;children:React.ReactNode}) {
  return <div><label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--s4)",display:"block",marginBottom:6}}>{label}</label>{children}</div>;
}
function Msg({text}:{text:string}) {
  return <div style={{marginBottom:16,padding:"9px 14px",borderRadius:10,fontSize:13,
    background:text.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
    border:`1px solid ${text.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
    color:text.startsWith("✅")?"#22c55e":"#ef4444"}}>{text}</div>;
}
