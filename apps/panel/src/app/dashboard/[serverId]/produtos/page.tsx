"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Product {
  id:string; name:string; description:string; price:number;
  original_price:number|null; product_type:string; stock:number;
  is_active:boolean; image_url:string|null;
}
interface ProductForm {
  name:string; description:string; price:string; original_price:string;
  stock:string; product_type:string; image_url:string;
}

const TYPE_LABELS: Record<string,string> = {
  key:"Chave / Serial", digital:"Arquivo Digital",
  role:"Cargo Discord", channel:"Canal Discord", webhook:"Webhook",
};
const TYPE_ICONS: Record<string,string> = {
  key:"◈", digital:"◉", role:"⬡", channel:"◇", webhook:"⬢",
};

const EMPTY: ProductForm = { name:"", description:"", price:"", original_price:"", stock:"-1", product_type:"key", image_url:"" };

const S = {
  label: { fontSize:11, fontWeight:700, textTransform:"uppercase" as const, letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 },
};

export default function ProdutosPage() {
  const { serverId } = useParams() as { serverId:string };
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string|null>(null);
  const [form, setForm]         = useState<ProductForm>(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");
  const [keysModal, setKeysModal] = useState<string|null>(null);
  const [keysText, setKeysText]   = useState("");
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => { load(); }, [serverId]);

  async function load() {
    setLoading(true);
    try { setProducts(await api.get<Product[]>("/products", serverId)); }
    catch { setProducts([]); } finally { setLoading(false); }
  }

  function openCreate() { setEditId(null); setForm(EMPTY); setShowForm(true); }
  function openEdit(p: Product) {
    setEditId(p.id);
    setForm({ name:p.name, description:p.description||"", price:String(p.price),
      original_price:p.original_price?String(p.original_price):"",
      stock:String(p.stock), product_type:p.product_type, image_url:p.image_url||"" });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, price:Number(form.price), stock:Number(form.stock),
        original_price: form.original_price ? Number(form.original_price) : null };
      if (editId) { await api.put(`/products/${editId}`, payload, serverId); toast("Produto atualizado!"); }
      else        { await api.post("/products", payload, serverId); toast("Produto criado!"); }
      setShowForm(false); load();
    } catch (err:any) { toast(err?.message || "Erro ao salvar", true); }
    finally { setSaving(false); }
  }

  async function toggle(p: Product) {
    await api.put(`/products/${p.id}`, { is_active:!p.is_active }, serverId).catch(()=>{});
    load();
  }

  async function importKeys() {
    if (!keysModal) return;
    const keys = keysText.split("\n").map(k=>k.trim()).filter(Boolean);
    if (!keys.length) return;
    try {
      await api.post(`/products/${keysModal}/keys`, { keys }, serverId);
      setImportMsg(`✅ ${keys.length} chaves importadas!`);
      setKeysText(""); load();
    } catch (err:any) { setImportMsg("❌ " + (err?.message||"Erro")); }
  }

  function toast(m: string, err=false) {
    setMsg((err?"❌ ":"✅ ") + m);
    setTimeout(()=>setMsg(""), 3000);
  }

  const active   = products.filter(p=>p.is_active);
  const inactive = products.filter(p=>!p.is_active);

  return (
    <div className="fu">
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:"var(--s1)" }}>Produtos</h1>
          <p style={{ fontSize:13, color:"var(--s3)", marginTop:3 }}>
            <span style={{ color:"#22c55e", fontWeight:600 }}>{active.length} ativos</span>
            {inactive.length>0 && <span style={{ color:"var(--s4)", marginLeft:8 }}>· {inactive.length} inativos</span>}
          </p>
        </div>
        <button className="vbp" onClick={openCreate}>+ Novo Produto</button>
      </div>

      {msg && (
        <div style={{ marginBottom:16, padding:"10px 16px", borderRadius:10, fontSize:13,
          background: msg.startsWith("✅") ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)",
          border: `1px solid ${msg.startsWith("✅") ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)"}`,
          color: msg.startsWith("✅") ? "#22c55e" : "#ef4444",
        }}>{msg}</div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:14 }}>
          {[1,2,3,4,5,6].map(i=>(
            <div key={i} style={{ height:220, borderRadius:14, background:"rgba(120,50,255,.06)", animation:"pulse 1.5s ease infinite" }} />
          ))}
        </div>
      ) : products.length===0 ? (
        <div className="vcard" style={{ textAlign:"center", padding:"80px 20px" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>◈</div>
          <p style={{ fontSize:17, fontWeight:700, color:"var(--s2)", marginBottom:8 }}>Nenhum produto ainda</p>
          <p style={{ fontSize:13, color:"var(--s4)", marginBottom:24 }}>Crie seu primeiro produto para começar a vender no Discord</p>
          <button className="vbp" onClick={openCreate}>+ Criar Produto</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:14 }}>
          {products.map(p=>{
            const stockOk = p.stock===-1||p.stock>5;
            const stockLow = p.stock>0&&p.stock<=5;
            return (
              <div key={p.id} className="vcard" style={{ overflow:"hidden", opacity:p.is_active?1:0.5, transition:"opacity .2s" }}>
                {p.image_url && (
                  <div style={{ height:130, overflow:"hidden", borderRadius:"13px 13px 0 0" }}>
                    <img src={p.image_url} alt={p.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  </div>
                )}
                <div style={{ padding:"14px 16px 16px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                    <p style={{ fontSize:14, fontWeight:700, color:"var(--s1)", lineHeight:1.3 }}>{p.name}</p>
                    <span style={{
                      fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:100, flexShrink:0,
                      background:"rgba(120,50,255,.12)", color:"var(--accent)",
                    }}>{TYPE_ICONS[p.product_type]} {TYPE_LABELS[p.product_type]||p.product_type}</span>
                  </div>
                  {p.description && <p style={{ fontSize:12, color:"var(--s4)", marginBottom:10, lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{p.description}</p>}

                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                    <div>
                      <span style={{ fontSize:20, fontWeight:800, color:"#22c55e" }}>R$ {p.price.toFixed(2)}</span>
                      {p.original_price && p.original_price>p.price && (
                        <span style={{ fontSize:12, color:"var(--s4)", textDecoration:"line-through", marginLeft:8 }}>R$ {p.original_price.toFixed(2)}</span>
                      )}
                    </div>
                    <span style={{
                      fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:100,
                      color: p.stock===0?"#ef4444":p.stock===-1?"#60a5fa":stockLow?"#f59e0b":"#22c55e",
                      background: p.stock===0?"rgba(239,68,68,.12)":p.stock===-1?"rgba(96,165,250,.12)":stockLow?"rgba(245,158,11,.12)":"rgba(34,197,94,.12)",
                    }}>
                      {p.stock===-1?"∞ Ilimitado":p.stock===0?"Esgotado":`${p.stock} un.`}
                    </span>
                  </div>

                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>openEdit(p)} className="vbg" style={{ flex:1, padding:"7px 0", fontSize:12, justifyContent:"center" }}>Editar</button>
                    {p.product_type==="key" && (
                      <button onClick={()=>{ setKeysModal(p.id); setImportMsg(""); }} className="vbg" style={{ flex:1, padding:"7px 0", fontSize:12, justifyContent:"center" }}>Chaves</button>
                    )}
                    <button onClick={()=>toggle(p)} className="vbg" style={{
                      flex:1, padding:"7px 0", fontSize:12, justifyContent:"center",
                      color: p.is_active ? "#f87171" : "#22c55e",
                    }}>{p.is_active?"Pausar":"Ativar"}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Form modal ── */}
      {showForm && (
        <Modal title={editId ? "Editar Produto" : "Novo Produto"} onClose={()=>setShowForm(false)} wide>
          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <Fld label="Nome *">
              <input className="vi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: VIP Mensal" required />
            </Fld>
            <Fld label="Descrição">
              <textarea className="vi" style={{ height:76, resize:"none" }} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Descreva o produto..." />
            </Fld>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Fld label="Preço (R$) *">
                <input type="number" step="0.01" min="0.01" className="vi" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="29.90" required />
              </Fld>
              <Fld label="Preço original (opcional)">
                <input type="number" step="0.01" min="0" className="vi" value={form.original_price} onChange={e=>setForm(f=>({...f,original_price:e.target.value}))} placeholder="49.90" />
              </Fld>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Fld label="Estoque (-1 = ilimitado)">
                <input type="number" min="-1" className="vi" value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} />
              </Fld>
              <Fld label="Tipo de entrega">
                <select className="vi" value={form.product_type} onChange={e=>setForm(f=>({...f,product_type:e.target.value}))}>
                  <option value="key">◈ Chave / Serial (via DM)</option>
                  <option value="digital">◉ Arquivo Digital (via DM)</option>
                  <option value="role">⬡ Cargo Discord (automático)</option>
                  <option value="channel">◇ Canal Discord (acesso)</option>
                  <option value="webhook">⬢ Webhook externo</option>
                </select>
              </Fld>
            </div>
            <Fld label="URL da imagem">
              <input className="vi" value={form.image_url} onChange={e=>setForm(f=>({...f,image_url:e.target.value}))} placeholder="https://..." />
            </Fld>
            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              <button type="button" className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={()=>setShowForm(false)}>Cancelar</button>
              <button type="submit" className="vbp" style={{ flex:1, justifyContent:"center" }} disabled={saving}>
                {saving ? "Salvando..." : editId ? "Salvar" : "Criar Produto"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Keys modal ── */}
      {keysModal && (
        <Modal title="Importar Chaves" onClose={()=>{ setKeysModal(null); setKeysText(""); setImportMsg(""); }}>
          <p style={{ fontSize:13, color:"var(--s3)", marginBottom:14, lineHeight:1.6 }}>
            Cole as chaves abaixo, uma por linha. Serão adicionadas ao estoque do produto.
          </p>
          <textarea className="vi" style={{ height:160, resize:"vertical", fontFamily:"monospace", fontSize:12 }}
            value={keysText} onChange={e=>setKeysText(e.target.value)}
            placeholder={"XXXX-YYYY-ZZZZ\nAAAA-BBBB-CCCC\n..."} />
          {importMsg && (
            <p style={{ fontSize:12, color: importMsg.startsWith("✅")?"#22c55e":"#ef4444", marginTop:8 }}>{importMsg}</p>
          )}
          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <button className="vbg" style={{ flex:1, justifyContent:"center" }} onClick={()=>{ setKeysModal(null); setKeysText(""); }}>Fechar</button>
            <button className="vbp" style={{ flex:1, justifyContent:"center" }} onClick={importKeys}>Importar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Fld({ label, children }: { label:string; children:React.ReactNode }) {
  return <div><label style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--s4)", display:"block", marginBottom:6 }}>{label}</label>{children}</div>;
}

function Modal({ title, onClose, children, wide }: { title:string; onClose:()=>void; children:React.ReactNode; wide?:boolean }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:16, width:"100%", maxWidth:wide?560:440, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid var(--border)" }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:"var(--s1)" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--s4)", fontSize:20, lineHeight:1, padding:"0 4px" }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}
