"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";

interface Settings {
  shop_channel_id?:string; log_channel_id?:string; order_role_id?:string;
  welcome_message?:string; currency_symbol?:string; purchase_cooldown?:number;
  max_orders_per_customer?:number; auto_confirm_pix?:boolean;
}

export default function ConfigPage() {
  const { serverId } = useParams() as { serverId:string };
  const [s, setS]       = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState("");

  useEffect(()=>{
    api.get<{settings:Settings}>(`/servers/${serverId}/settings`,serverId)
      .then(d=>setS(d?.settings||{})).catch(()=>{}).finally(()=>setLoading(false));
  },[serverId]);

  async function save(e:React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/servers/${serverId}/settings`,s,serverId);
      setMsg("✅ Salvo!"); setTimeout(()=>setMsg(""),3000);
    } catch(err:any) { setMsg("❌ "+(err?.message||"Erro")); setTimeout(()=>setMsg(""),3000); }
    finally { setSaving(false); }
  }

  const upd = (k:keyof Settings, v:any) => setS(x=>({...x,[k]:v}));

  if(loading) return <div style={{height:200,borderRadius:14,background:"rgba(120,50,255,.06)"}} />;

  return (
    <div className="fu">
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:22,fontWeight:800,color:"var(--s1)"}}>Configurações</h1>
        <p style={{fontSize:13,color:"var(--s3)",marginTop:3}}>Ajuste as opções gerais do seu servidor</p>
        {msg && <div style={{marginTop:12,padding:"9px 14px",borderRadius:10,fontSize:13,display:"inline-block",
          background:msg.startsWith("✅")?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",
          border:`1px solid ${msg.startsWith("✅")?"rgba(34,197,94,.2)":"rgba(239,68,68,.2)"}`,
          color:msg.startsWith("✅")?"#22c55e":"#ef4444"}}>{msg}</div>}
      </div>

      <form onSubmit={save} style={{maxWidth:700,display:"flex",flexDirection:"column",gap:20}}>

        <Section title="Canais Discord">
          <Grid>
            <Fld label="Canal da Loja" hint="ID do canal onde a /loja será exibida">
              <input className="vi" value={s.shop_channel_id||""} onChange={e=>upd("shop_channel_id",e.target.value)} placeholder="123456789012345678" />
            </Fld>
            <Fld label="Canal de Logs" hint="Registro de todas as vendas">
              <input className="vi" value={s.log_channel_id||""} onChange={e=>upd("log_channel_id",e.target.value)} placeholder="123456789012345678" />
            </Fld>
            <Fld label="Cargo para Compradores" hint="Atribuído automaticamente após compra">
              <input className="vi" value={s.order_role_id||""} onChange={e=>upd("order_role_id",e.target.value)} placeholder="123456789012345678" />
            </Fld>
          </Grid>
          <p style={{fontSize:11,color:"var(--s4)",marginTop:12,lineHeight:1.6}}>
            Para obter o ID: ative o Modo Desenvolvedor no Discord (Configurações → Avançado), depois clique com botão direito no canal/cargo e selecione "Copiar ID".
          </p>
        </Section>

        <Section title="Loja">
          <Grid>
            <Fld label="Símbolo da moeda">
              <input className="vi" value={s.currency_symbol||"R$"} onChange={e=>upd("currency_symbol",e.target.value)} placeholder="R$" maxLength={5} />
            </Fld>
            <Fld label="Cooldown entre compras (segundos)" hint="0 = sem limite">
              <input type="number" min="0" className="vi" value={s.purchase_cooldown??0} onChange={e=>upd("purchase_cooldown",Number(e.target.value))} />
            </Fld>
            <Fld label="Máx. pedidos pendentes por cliente" hint="-1 = ilimitado">
              <input type="number" min="-1" className="vi" value={s.max_orders_per_customer??-1} onChange={e=>upd("max_orders_per_customer",Number(e.target.value))} />
            </Fld>
          </Grid>
        </Section>

        <Section title="Automações">
          <label style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"14px 16px",borderRadius:10,border:"1px solid var(--border)",background:"rgba(120,50,255,.04)"}}>
            <div onClick={()=>upd("auto_confirm_pix",!s.auto_confirm_pix)} style={{
              width:42,height:24,borderRadius:100,background:s.auto_confirm_pix?"#7c3aed":"rgba(255,255,255,.08)",
              position:"relative",transition:"background .2s",flexShrink:0,cursor:"pointer",
              border:"1px solid "+(s.auto_confirm_pix?"#7c3aed":"rgba(255,255,255,.1)"),
            }}>
              <div style={{
                position:"absolute",top:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",
                left: s.auto_confirm_pix?22:3,
                boxShadow:"0 1px 4px rgba(0,0,0,.4)",
              }} />
            </div>
            <div>
              <p style={{fontSize:14,fontWeight:600,color:"var(--s1)"}}>Confirmar Pix automático</p>
              <p style={{fontSize:12,color:"var(--s4)",marginTop:2}}>Confirma pagamentos Pix manual automaticamente via webhook do banco</p>
            </div>
          </label>
        </Section>

        <Section title="Mensagens">
          <Fld label="Mensagem de boas-vindas (DM após compra)">
            <textarea className="vi" style={{height:100,resize:"vertical"}} value={s.welcome_message||""} onChange={e=>upd("welcome_message",e.target.value)} placeholder="Olá {usuario}! Obrigado pela sua compra de {produto}. Qualquer dúvida, abra um ticket." />
          </Fld>
          <p style={{fontSize:11,color:"var(--s4)",marginTop:8}}>Variáveis: {"{usuario}"} {"{produto}"} {"{pedido}"} {"{servidor}"}</p>
        </Section>

        <button type="submit" className="vbp" style={{alignSelf:"flex-start",padding:"10px 32px"}} disabled={saving}>
          {saving?"Salvando...":"Salvar configurações"}
        </button>
      </form>
    </div>
  );
}

function Section({title,children}:{title:string;children:React.ReactNode}) {
  return (
    <div className="vcard" style={{padding:24}}>
      <h2 style={{fontSize:14,fontWeight:700,color:"var(--s1)",marginBottom:18,paddingBottom:14,borderBottom:"1px solid var(--border)"}}>{title}</h2>
      {children}
    </div>
  );
}
function Grid({children}:{children:React.ReactNode}) {
  return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14}}>{children}</div>;
}
function Fld({label,hint,children}:{label:string;hint?:string;children:React.ReactNode}) {
  return (
    <div>
      <label style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"var(--s4)",display:"block",marginBottom:6}}>{label}</label>
      {children}
      {hint && <p style={{fontSize:11,color:"var(--s4)",marginTop:5}}>{hint}</p>}
    </div>
  );
}
