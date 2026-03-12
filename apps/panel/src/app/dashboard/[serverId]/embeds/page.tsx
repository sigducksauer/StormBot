"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface EmbedConfig {
  title:string; description:string; color:string;
  thumbnail_url:string; image_url:string; footer_text:string;
  footer_icon:string; author_name:string; author_icon:string;
  fields: { name:string; value:string; inline:boolean }[];
}
interface SavedEmbed extends EmbedConfig { id?:string; name:string }

const TYPES = [
  { key:"loja",     label:"Loja",     desc:"Vitrine principal" },
  { key:"produto",  label:"Produto",  desc:"Detalhes do produto" },
  { key:"checkout", label:"Checkout", desc:"Confirmar compra" },
  { key:"pix",      label:"Pix",      desc:"Instrução de pagamento" },
  { key:"sucesso",  label:"Sucesso",  desc:"Compra confirmada" },
  { key:"erro",     label:"Erro",     desc:"Mensagem de erro" },
];

const VARS = ["{produto}","{preco}","{descricao}","{servidor}","{usuario}","{pedido}"];

const DEFAULT: EmbedConfig = {
  title:"", description:"", color:"#7c3aed",
  thumbnail_url:"", image_url:"", footer_text:"VendBot",
  footer_icon:"", author_name:"", author_icon:"", fields:[],
};

const I = { label: { fontSize:11, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 } };

export default function EmbedsPage() {
  const { serverId } = useParams() as { serverId:string };
  const [type, setType]       = useState("loja");
  const [saved, setSaved]     = useState<Record<string,SavedEmbed>>({});
  const [config, setConfig]   = useState<EmbedConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");
  const [activeTab, setTab]   = useState<"basic"|"media"|"fields"|"meta">("basic");
  const [showPicker, setPicker] = useState(false);

  useEffect(()=>{
    api.get<SavedEmbed[]>("/embeds", serverId)
      .then(d=>{ const m:Record<string,SavedEmbed>={}; (d||[]).forEach(e=>m[e.name]=e); setSaved(m); })
      .catch(()=>{}).finally(()=>setLoading(false));
  },[serverId]);

  useEffect(()=>{
    setConfig({ ...DEFAULT, ...(saved[type]||{}) });
  },[type, saved]);

  const upd = (k:keyof EmbedConfig, v:any) => setConfig(c=>({...c,[k]:v}));
  const updField = (i:number, k:string, v:any) => setConfig(c=>{ const f=[...c.fields]; f[i]={...f[i],[k]:v}; return {...c,fields:f}; });

  async function handleSave() {
    setSaving(true);
    try {
      const existing = saved[type];
      if(existing?.id) await api.put(`/embeds/${existing.id}`, {...config,name:type}, serverId);
      else await api.post("/embeds", {...config,name:type}, serverId);
      setMsg("✅ Salvo!"); setTimeout(()=>setMsg(""),3000);
      const d = await api.get<SavedEmbed[]>("/embeds", serverId);
      const m:Record<string,SavedEmbed>={}; (d||[]).forEach(e=>m[e.name]=e); setSaved(m);
    } catch(err:any) { setMsg("❌ "+(err?.message||"Erro")); setTimeout(()=>setMsg(""),3000); }
    finally { setSaving(false); }
  }

  const TABS = ["basic","media","fields","meta"] as const;
  const TAB_LABELS = { basic:"Texto", media:"Imagens", fields:"Campos extras", meta:"Autor & Rodapé" };

  return (
    <div className="fu">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Editor de Embeds</h1>
        <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>Personalize como cada mensagem aparece no Discord</p>
        {msg && <div style={{ marginTop:12, padding:"8px 14px", borderRadius:10, fontSize:13, display:"inline-block",
          background:msg.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
          border:`1px solid ${msg.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
          color:msg.startsWith("✅")?"#22c55e":"#ef4444" }}>{msg}</div>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.1fr", gap:20, alignItems:"start" }}>

        {/* Left: editor */}
        <div>
          {/* Type selector */}
          <div style={{ display:"flex", gap:6, marginBottom:18, flexWrap:"wrap" }}>
            {TYPES.map(t=>(
              <button key={t.key} onClick={()=>{ setType(t.key); setTab("basic"); }} style={{
                padding:"6px 14px", borderRadius:8, border:"1px solid", cursor:"pointer", fontSize:12, fontWeight:600,
                background: type===t.key?"rgba(124,58,237,.18)":"transparent",
                borderColor: type===t.key?"rgba(168,85,247,.5)":"var(--border)",
                color: type===t.key?"#c8bfe8":"var(--s4)",
              }}>{t.label}</button>
            ))}
          </div>

          <div className="vcard" style={{ padding:24 }}>
            {/* Tabs */}
            <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:"1px solid var(--border)", paddingBottom:14 }}>
              {TABS.map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{
                  padding:"5px 12px", borderRadius:7, border:"none", cursor:"pointer", fontSize:12, fontWeight:600,
                  background: activeTab===t?"rgba(124,58,237,.2)":"transparent",
                  color: activeTab===t?"#c8bfe8":"var(--s4)",
                }}>{TAB_LABELS[t]}</button>
              ))}
            </div>

            {/* Variables hint */}
            <div style={{ marginBottom:16, padding:"9px 12px", borderRadius:8, background:"rgba(120,50,255,.08)", border:"1px solid rgba(120,50,255,.15)" }}>
              <p style={{ fontSize:11, color:"var(--s4)", marginBottom:6 }}>Variáveis disponíveis:</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {VARS.map(v=>(
                  <code key={v} style={{ fontSize:11, background:"rgba(120,50,255,.2)", color:"#c8bfe8", padding:"2px 7px", borderRadius:5, cursor:"pointer" }}
                    onClick={()=>{ if(activeTab==="basic") upd("title", config.title+v); }}>{v}</code>
                ))}
              </div>
            </div>

            {activeTab==="basic" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={I.label}>Título</label>
                  <input className="vi" value={config.title} onChange={e=>upd("title",e.target.value)} placeholder="Título da embed" />
                </div>
                <div>
                  <label style={I.label}>Descrição</label>
                  <textarea className="vi" style={{ height:100, resize:"vertical" }} value={config.description} onChange={e=>upd("description",e.target.value)} placeholder="Texto principal da embed..." />
                </div>
                <div>
                  <label style={I.label}>Cor da barra lateral</label>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:9, background:config.color, border:"2px solid rgba(255,255,255,.1)", cursor:"pointer", flexShrink:0 }}
                      onClick={()=>setPicker(p=>!p)} />
                    <input className="vi" value={config.color} onChange={e=>upd("color",e.target.value)} placeholder="#7c3aed" />
                  </div>
                  {showPicker && (
                    <div style={{ marginTop:10, padding:14, borderRadius:12, background:"var(--surface)", border:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8 }}>
                      <p style={{ fontSize:11, color:"var(--s4)" }}>Paleta rápida:</p>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                        {["#7c3aed","#a855f7","#5865f2","#22c55e","#ef4444","#f59e0b","#0ea5e9","#ec4899","#14b8a6","#000000"].map(c=>(
                          <div key={c} style={{ width:28, height:28, borderRadius:7, background:c, cursor:"pointer", border: config.color===c?"2px solid #fff":"2px solid transparent" }}
                            onClick={()=>{ upd("color",c); setPicker(false); }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab==="media" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={I.label}>URL da miniatura (thumbnail)</label>
                  <input className="vi" value={config.thumbnail_url} onChange={e=>upd("thumbnail_url",e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label style={I.label}>URL da imagem grande</label>
                  <input className="vi" value={config.image_url} onChange={e=>upd("image_url",e.target.value)} placeholder="https://..." />
                </div>
              </div>
            )}

            {activeTab==="fields" && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {config.fields.map((f,i)=>(
                  <div key={i} style={{ padding:14, borderRadius:10, background:"rgba(120,50,255,.06)", border:"1px solid var(--border)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:"var(--s3)" }}>Campo {i+1}</span>
                      <button onClick={()=>upd("fields",config.fields.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", fontSize:16 }}>✕</button>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      <input className="vi" value={f.name} onChange={e=>updField(i,"name",e.target.value)} placeholder="Nome do campo" style={{ fontSize:12 }} />
                      <input className="vi" value={f.value} onChange={e=>updField(i,"value",e.target.value)} placeholder="Valor" style={{ fontSize:12 }} />
                      <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                        <input type="checkbox" checked={f.inline} onChange={e=>updField(i,"inline",e.target.checked)} style={{ accentColor:"#7c3aed" }} />
                        <span style={{ fontSize:12, color:"var(--s3)" }}>Inline (ao lado)</span>
                      </label>
                    </div>
                  </div>
                ))}
                <button className="vbg" style={{ justifyContent:"center", fontSize:12 }}
                  onClick={()=>upd("fields",[...config.fields,{name:"Novo campo",value:"Valor",inline:true}])}>
                  + Adicionar campo
                </button>
              </div>
            )}

            {activeTab==="meta" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={I.label}>Nome do autor</label>
                  <input className="vi" value={config.author_name} onChange={e=>upd("author_name",e.target.value)} placeholder="Nome que aparece acima do título" />
                </div>
                <div>
                  <label style={I.label}>Ícone do autor (URL)</label>
                  <input className="vi" value={config.author_icon} onChange={e=>upd("author_icon",e.target.value)} placeholder="https://..." />
                </div>
                <div>
                  <label style={I.label}>Texto do rodapé</label>
                  <input className="vi" value={config.footer_text} onChange={e=>upd("footer_text",e.target.value)} placeholder="VendBot • Compras seguras" />
                </div>
                <div>
                  <label style={I.label}>Ícone do rodapé (URL)</label>
                  <input className="vi" value={config.footer_icon} onChange={e=>upd("footer_icon",e.target.value)} placeholder="https://..." />
                </div>
              </div>
            )}

            <button className="vbp" style={{ width:"100%", justifyContent:"center", marginTop:20 }} onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar embed"}
            </button>
          </div>
        </div>

        {/* Right: preview */}
        <div>
          <p style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", marginBottom:10 }}>Preview (simulação Discord)</p>
          <div style={{ padding:20, borderRadius:14, background:"#313338", minHeight:200 }}>
            <DiscordPreview config={config} />
          </div>
          <p style={{ fontSize:11, color:"var(--s4)", marginTop:10, textAlign:"center" }}>
            Aparência aproximada. Pode variar ligeiramente no Discord.
          </p>
        </div>

      </div>
    </div>
  );
}

function DiscordPreview({ config }: { config:EmbedConfig }) {
  const colorInt = parseInt(config.color.replace("#",""),16);
  const r = (colorInt>>16)&255, g=(colorInt>>8)&255, b=colorInt&255;
  const has = config.title||config.description||config.fields.length>0;
  if(!has) return <p style={{ textAlign:"center", color:"#949ba4", fontSize:13, paddingTop:32 }}>Preencha os campos para visualizar</p>;

  return (
    <div style={{ display:"flex", gap:4 }}>
      <div style={{ width:4, borderRadius:3, flexShrink:0, background:config.color||"#5865f2", minHeight:50 }} />
      <div style={{ flex:1, background:"#2b2d31", borderRadius:"0 4px 4px 0", padding:"12px 14px" }}>
        {config.author_name && (
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
            {config.author_icon && <img src={config.author_icon} alt="" style={{ width:18, height:18, borderRadius:"50%", objectFit:"cover" }} onError={e=>(e.target as any).style.display="none"} />}
            <span style={{ fontSize:12, fontWeight:600, color:"#e3e5e8" }}>{config.author_name}</span>
          </div>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
          <div style={{ flex:1 }}>
            {config.title && <p style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:6 }}>{config.title}</p>}
            {config.description && <p style={{ fontSize:13, color:"#dbdee1", lineHeight:1.5, whiteSpace:"pre-line" }}>{config.description}</p>}
          </div>
          {config.thumbnail_url && (
            <img src={config.thumbnail_url} alt="" style={{ width:64, height:64, borderRadius:4, objectFit:"cover", flexShrink:0 }}
              onError={e=>(e.target as any).style.display="none"} />
          )}
        </div>
        {config.fields.length>0 && (
          <div style={{ marginTop:10, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {config.fields.map((f,i)=>(
              <div key={i} style={{ gridColumn: f.inline?"span 1":"span 3" }}>
                <p style={{ fontSize:12, fontWeight:700, color:"#e3e5e8", marginBottom:2 }}>{f.name}</p>
                <p style={{ fontSize:12, color:"#dbdee1" }}>{f.value}</p>
              </div>
            ))}
          </div>
        )}
        {config.image_url && (
          <img src={config.image_url} alt="" style={{ width:"100%", borderRadius:4, marginTop:10, maxHeight:200, objectFit:"cover" }}
            onError={e=>(e.target as any).style.display="none"} />
        )}
        {config.footer_text && (
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:10, paddingTop:8, borderTop:"1px solid rgba(255,255,255,.05)" }}>
            {config.footer_icon && <img src={config.footer_icon} alt="" style={{ width:14, height:14, borderRadius:"50%", objectFit:"cover" }} onError={e=>(e.target as any).style.display="none"} />}
            <span style={{ fontSize:11, color:"#949ba4" }}>{config.footer_text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
