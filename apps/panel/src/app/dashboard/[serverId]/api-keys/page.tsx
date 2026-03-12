"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Key { id:string; name:string; key_prefix:string; scopes:string[]; is_active:boolean; last_used:string|null; expires_at:string|null; created_at:string; key?:string }

const SCOPE_GROUPS = [
  { g:"Produtos",    scopes:["products:read","products:write"] },
  { g:"Pedidos",     scopes:["orders:read","orders:write"] },
  { g:"Clientes",    scopes:["customers:read","customers:write"] },
  { g:"Analytics",   scopes:["analytics:read"] },
  { g:"Cupons",      scopes:["coupons:read","coupons:write"] },
  { g:"Webhooks",    scopes:["webhooks:read","webhooks:write"] },
];
const ALL_SCOPES = SCOPE_GROUPS.flatMap(g=>g.scopes);

export default function ApiKeysPage() {
  const { serverId } = useParams() as { serverId:string };
  const [keys,    setKeys]    = useState<Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [form,    setForm]    = useState({ name:"", scopes:[] as string[], expires_at:"" });
  const [saving,  setSaving]  = useState(false);
  const [newKey,  setNewKey]  = useState<string|null>(null);
  const [msg,     setMsg]     = useState("");
  const [copied,  setCopied]  = useState(false);

  useEffect(() => { load(); }, [serverId]);

  async function load() {
    setLoading(true);
    try { setKeys(await api.get<Key[]>("/api-keys", serverId)); }
    catch { setKeys([]); } finally { setLoading(false); }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const d = await api.post<{key:string}>("/api-keys", { ...form, expires_at:form.expires_at||null }, serverId);
      setNewKey(d.key); setOpen(false); setForm({ name:"", scopes:[], expires_at:"" }); load();
    } catch(err:any) { toast(err?.message||"Erro",true); }
    finally { setSaving(false); }
  }

  async function revoke(id:string) {
    if (!confirm("Revogar esta API key? Todas as integrações que a usam vão parar de funcionar.")) return;
    await api.delete(`/api-keys/${id}`, serverId).catch(()=>{}); load();
  }

  function toggleScope(s:string) {
    setForm(f=>({ ...f, scopes:f.scopes.includes(s)?f.scopes.filter(x=>x!==s):[...f.scopes,s] }));
  }
  function selectAll() { setForm(f=>({ ...f, scopes:[...ALL_SCOPES] })); }
  function clearAll()  { setForm(f=>({ ...f, scopes:[] })); }

  async function copyKey(k:string) {
    await navigator.clipboard.writeText(k).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  function toast(m:string,err=false) { setMsg((err?"❌ ":"✅ ")+m); setTimeout(()=>setMsg(""),3000); }

  return (
    <div className="fu">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>API Keys</h1>
          <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>Integre sistemas externos com a API pública do VendBot</p>
        </div>
        <button className="vbp" onClick={()=>setOpen(true)}>+ Criar API Key</button>
      </div>
      {msg && <Msg text={msg} />}

      {/* New key banner */}
      {newKey && (
        <div style={{ marginBottom:20, padding:"16px 20px", borderRadius:12, background:"rgba(34,197,94,.08)", border:"1px solid rgba(34,197,94,.25)" }}>
          <p style={{ fontSize:13, fontWeight:700, color:"#22c55e", marginBottom:8 }}>✅ API Key criada! Copie agora — ela não será exibida novamente.</p>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <code style={{ flex:1, padding:"9px 12px", borderRadius:8, background:"rgba(0,0,0,.4)", color:"#a855f7", fontSize:12, fontFamily:"monospace", wordBreak:"break-all" }}>{newKey}</code>
            <button onClick={()=>copyKey(newKey)} style={{ padding:"9px 16px", borderRadius:8, border:"1px solid rgba(34,197,94,.4)", background:"rgba(34,197,94,.12)", color:"#22c55e", cursor:"pointer", fontSize:12, fontWeight:700, flexShrink:0 }}>
              {copied?"✓ Copiado":"Copiar"}
            </button>
          </div>
          <button onClick={()=>setNewKey(null)} style={{ marginTop:10, fontSize:11, background:"none", border:"none", cursor:"pointer", color:"var(--s4)" }}>Fechar aviso</button>
        </div>
      )}

      {/* API docs hint */}
      <div style={{ marginBottom:20, padding:"14px 18px", borderRadius:12, background:"rgba(120,50,255,.06)", border:"1px solid rgba(120,50,255,.14)", display:"flex", gap:16, alignItems:"center" }}>
        <span style={{ fontSize:24 }}>◎</span>
        <div>
          <p style={{ fontSize:13, fontWeight:700, color:"var(--s1)" }}>API pública disponível</p>
          <p style={{ fontSize:12, color:"var(--s4)", marginTop:2 }}>
            Base URL: <code style={{ fontSize:11, color:"#a855f7" }}>https://api.vendbot.app/v1</code>
            <span style={{ marginLeft:12 }}>· Autenticação: Bearer token no header <code style={{ fontSize:11 }}>Authorization</code></span>
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[1,2].map(i=><div key={i} style={{ height:80, borderRadius:12, background:"rgba(120,50,255,.06)" }} />)}
        </div>
      ) : keys.length===0 ? (
        <div className="vcard" style={{ textAlign:"center", padding:"64px 20px" }}>
          <div style={{ fontSize:36, marginBottom:14 }}>⬡</div>
          <p style={{ fontSize:16, fontWeight:700, color:"var(--s2)", marginBottom:8 }}>Nenhuma API Key criada</p>
          <p style={{ fontSize:13, color:"var(--s4)", marginBottom:24 }}>Crie uma chave para integrar com sistemas externos</p>
          <button className="vbp" onClick={()=>setOpen(true)}>+ Criar API Key</button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {keys.map(k=>(
            <div key={k.id} className="vcard" style={{ padding:"18px 22px", display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <p style={{ fontSize:14, fontWeight:700, color:"var(--s1)" }}>{k.name}</p>
                  <span className="badge" style={{ background:k.is_active?"rgba(34,197,94,.1)":"rgba(71,85,105,.1)", color:k.is_active?"#22c55e":"var(--s4)" }}>
                    {k.is_active?"Ativa":"Revogada"}
                  </span>
                </div>
                <code style={{ fontSize:12, color:"#a855f7", display:"block", marginBottom:8 }}>{k.key_prefix}••••••••••••••••••••••••••••••</code>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
                  {k.scopes.map(s=>(
                    <span key={s} style={{ fontSize:10, padding:"2px 7px", borderRadius:100, background:"rgba(120,50,255,.12)", border:"1px solid rgba(120,50,255,.2)", color:"#c8bfe8", fontFamily:"monospace" }}>{s}</span>
                  ))}
                </div>
                <p style={{ fontSize:11, color:"var(--s4)" }}>
                  Criado {new Date(k.created_at).toLocaleDateString("pt-BR")}
                  {k.last_used && <span style={{ marginLeft:12 }}>· Último uso: {new Date(k.last_used).toLocaleDateString("pt-BR")}</span>}
                  {k.expires_at && <span style={{ marginLeft:12 }}>· Expira: {new Date(k.expires_at).toLocaleDateString("pt-BR")}</span>}
                </p>
              </div>
              <button onClick={()=>revoke(k.id)} disabled={!k.is_active} style={{
                fontSize:11, padding:"6px 14px", borderRadius:8,
                border:"1px solid rgba(239,68,68,.3)", background:"rgba(239,68,68,.08)",
                color:"#ef4444", cursor:"pointer", flexShrink:0,
                opacity:k.is_active?1:0.4,
              }}>Revogar</button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16, overflowY:"auto" }}>
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, width:"100%", maxWidth:520, boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid var(--border)" }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:"var(--s1)" }}>Nova API Key</h2>
              <button onClick={()=>setOpen(false)} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--s4)",fontSize:20 }}>✕</button>
            </div>
            <form onSubmit={create} style={{ padding:"20px 24px 24px", display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <label style={LS}>Nome *</label>
                <input className="vi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Integração N8N" required />
              </div>

              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <label style={LS}>Escopos de acesso</label>
                  <div style={{ display:"flex", gap:8 }}>
                    <button type="button" onClick={selectAll} style={{ fontSize:11, color:"#a855f7", background:"none", border:"none", cursor:"pointer" }}>Todos</button>
                    <button type="button" onClick={clearAll} style={{ fontSize:11, color:"var(--s4)", background:"none", border:"none", cursor:"pointer" }}>Limpar</button>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {SCOPE_GROUPS.map(g=>(
                    <div key={g.g}>
                      <p style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", color:"var(--s4)", marginBottom:5 }}>{g.g}</p>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
                        {g.scopes.map(s=>(
                          <label key={s} style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", padding:"6px 10px", borderRadius:7, border:`1px solid ${form.scopes.includes(s)?"rgba(120,50,255,.3)":"var(--border)"}`, background:form.scopes.includes(s)?"rgba(120,50,255,.08)":"transparent" }}>
                            <input type="checkbox" checked={form.scopes.includes(s)} onChange={()=>toggleScope(s)} style={{ accentColor:"#7c3aed" }} />
                            <code style={{ fontSize:11, color:"var(--s2)" }}>{s}</code>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={LS}>Expira em (opcional)</label>
                <input type="datetime-local" className="vi" value={form.expires_at} onChange={e=>setForm(f=>({...f,expires_at:e.target.value}))} />
              </div>

              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={()=>setOpen(false)}>Cancelar</button>
                <button type="submit" className="vbp" style={{ flex:1, justifyContent:"center" }} disabled={saving||form.scopes.length===0}>{saving?"Criando...":"Criar Key"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const LS = { fontSize:11, fontWeight:700 as const, textTransform:"uppercase" as const, letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 };
function Msg({text}:{text:string}) {
  return <div style={{marginBottom:16,padding:"9px 14px",borderRadius:10,fontSize:13,
    background:text.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
    border:`1px solid ${text.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
    color:text.startsWith("✅")?"#22c55e":"#ef4444"}}>{text}</div>;
}
