"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

/* ─────────────────── DATA ──────────────────────────────── */
const FEATURES = [
  { g:"◈", n:"01", t:"Produtos & Variantes",  d:"Digital, chave, cargo ou canal. Variantes ilimitadas (ex: IPTV 1, 2, 3 telas) com estoque automático e alertas de estoque baixo." },
  { g:"◇", n:"02", t:"Multi-Gateway",          d:"Mercado Pago, Stripe, Pix, Asaas, PushinPay e mais. Webhook automático, expiração de pagamento e chargeback detection inclusos." },
  { g:"◉", n:"03", t:"Entrega Automática",     d:"Chaves por DM, arquivos, cargos e acesso a canais Discord entregues instantaneamente após o pagamento confirmar." },
  { g:"▦", n:"04", t:"Analytics Avançado",     d:"Receita por hora, ticket médio, funil de conversão, clientes recorrentes e top produtos. Dashboards em tempo real." },
  { g:"⬢", n:"05", t:"Automações & Flows",     d:"Carrinho abandonado, DM pós-compra, cupons automáticos e remoção de cargos ao expirar assinatura." },
  { g:"◆", n:"06", t:"Sistema de Afiliados",   d:"Links de afiliado, comissões automáticas, painel do afiliado, ranking e saque via Pix com um clique." },
];

const STEPS = [
  { n:"01", t:"Conecte o Discord",    d:"Login com OAuth2. Adicione o bot ao servidor com um clique. Zero configuração técnica." },
  { n:"02", t:"Configure o Gateway",  d:"Cole suas credenciais do Mercado Pago, Pix ou Stripe. Ativo em 2 minutos." },
  { n:"03", t:"Crie seus Produtos",   d:"Nome, preço, tipo de entrega. O embed da loja é gerado automaticamente no canal Discord." },
  { n:"04", t:"Comece a Vender",      d:"Clientes compram direto pelo Discord. Entrega automática, sem nenhuma ação manual." },
];

const PLANS = [
  { key:"simples",     name:"Simples",    price:null,    fee:"7%", hot:false, cta:"Começar grátis",
    on:["5 produtos","Pix Manual","1 embed","Suporte Discord"],
    off:["Variantes","Afiliados","Automações","API pública"] },
  { key:"standard",   name:"Standard",   price:29.90,   fee:"4%", hot:true,  cta:"Assinar Standard",
    on:["30 produtos","MercadoPago + Pix","Todos os embeds","Cupons avançados","Afiliados","Automações"],
    off:["API pública","White-label"] },
  { key:"premium",    name:"Premium",    price:79.90,   fee:"2%", hot:false, cta:"Assinar Premium",
    on:["Produtos ilimitados","Todos os gateways","API pública","Analytics 1 ano","Equipe ilimitada","Backup automático"],
    off:["White-label","Domínio próprio"] },
  { key:"enterprise", name:"Enterprise", price:199.90,  fee:"1%", hot:false, cta:"Falar com o time",
    on:["Tudo do Premium","White-label","Domínio próprio","SLA 99.9%","Gerente dedicado","Suporte 24/7","Integrações custom","Onboarding assist."],
    off:[] },
];

const GWS = [
  { n:"Mercado Pago", s:"Pix · Cartão · Boleto" },
  { n:"Stripe",       s:"Cartão Internacional"   },
  { n:"Pix Manual",   s:"QR Code Gerado"          },
  { n:"Asaas",        s:"Pix · Boleto · Cartão"  },
  { n:"PushinPay",    s:"Pix Instantâneo"         },
  { n:"PagSeguro",    s:"Multi-método"            },
  { n:"MisticPay",    s:"Pix · Cripto"            },
  { n:"PayPal",       s:"Internacional"           },
];

const TICKER  = ["Storm Bots","Pix Automático","Mercado Pago","Stripe","Entrega Instantânea","Analytics Avançado","Afiliados","Automações","Multi-Tenant","Anti-Fraude"];
const TAPE_ROWS = [
  { words:["Storm Bots","Server"],         dur:50, rev:false },
  { words:["Vendas","Discord"],            dur:42, rev:true  },
  { words:["Bots","Storm","Server"],       dur:48, rev:false },
  { words:["Storm Bots","Vendas Discord"], dur:55, rev:true  },
  { words:["Server","Storm","Bots"],       dur:46, rev:false },
  { words:["Storm Bots","Discord"],        dur:38, rev:true  },
];

/* ─────────────────── LIGHTNING HOOK ───────────────────── */
function useLightning(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0, timer = 0;

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    function bolt(x1:number,y1:number,x2:number,y2:number,off:number,iter:number) {
      if (iter === 0) { ctx.lineTo(x2,y2); return; }
      const mx=(x1+x2)/2+(Math.random()-.5)*off;
      const my=(y1+y2)/2+(Math.random()-.5)*off;
      bolt(x1,y1,mx,my,off/2,iter-1);
      bolt(mx,my,x2,y2,off/2,iter-1);
    }

    function strike() {
      ctx.clearRect(0,0,W,H);
      const x = W*.1 + Math.random()*W*.8;
      ctx.shadowColor="rgba(255,255,255,.25)"; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.moveTo(x,0);
      bolt(x,0,x+(Math.random()-.5)*180,H*.65,90,7);
      ctx.strokeStyle=`rgba(255,255,255,${.07+Math.random()*.06})`;
      ctx.lineWidth=.7+Math.random()*.7; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,H*.18);
      bolt(x,H*.18,x+(Math.random()-.5)*130,H*.42,55,5);
      ctx.strokeStyle=`rgba(255,255,255,${.04+Math.random()*.04})`;
      ctx.lineWidth=.4; ctx.stroke();
      canvas.style.opacity="1";
      setTimeout(() => { ctx.clearRect(0,0,W,H); canvas.style.opacity="0"; }, 55+Math.random()*80);
    }

    function schedule() { strike(); timer = window.setTimeout(schedule, 4500+Math.random()*9000); }
    const init = window.setTimeout(schedule, 2000);

    let lastFlash = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - lastFlash < 1800) return;
      document.querySelectorAll("section").forEach(s => {
        const r = s.getBoundingClientRect();
        if (r.top > -10 && r.top < 60) { lastFlash = now; strike(); }
      });
    };
    window.addEventListener("scroll", onScroll, { passive:true });

    return () => { clearTimeout(init); clearTimeout(timer); window.removeEventListener("resize", resize); window.removeEventListener("scroll", onScroll); };
  }, [ref]);
}

/* ─────────────────── REVEAL HOOK ──────────────────────── */
function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement;
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          io.unobserve(el);
        }
      });
    }, { threshold:.08, rootMargin:"0px 0px -28px 0px" });
    document.querySelectorAll<HTMLElement>(".rv").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─────────────────── PARALLAX HOOK ────────────────────── */
function useParallax() {
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const tapes = document.getElementById("sb-tapes");
      const title = document.getElementById("sb-title");
      if (tapes) tapes.style.transform = `skewX(-5deg) translateY(${y*.1}px)`;
      if (title) title.style.transform = `translateY(${y*.04}px)`;
    };
    window.addEventListener("scroll", onScroll, { passive:true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

/* ─────────────────── PAGE ──────────────────────────────── */
export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLightning(canvasRef);
  useReveal();
  useParallax();

  const DELAYS = ["","d1","d2","d3","d4","d5"] as const;

  return (
    <>
      {/* ── GLOBAL CSS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&family=Barlow:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        :root{
          --ink:#050505; --paper:#0d0d0d; --card:#111;
          --edge:#1c1c1c; --white:#f2ede6; --chalk:#c8c4bc;
          --silver:#9a9590; --dust:#474340; --warn:#e8dcc8;
        }
        body{
          background:var(--ink); color:var(--white);
          font-family:'Barlow',sans-serif; font-weight:400;
          overflow-x:hidden; cursor:crosshair;
        }
        body::after{
          content:''; position:fixed; inset:0;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
          opacity:.038; pointer-events:none; z-index:9999; mix-blend-mode:overlay;
        }
        ::-webkit-scrollbar{width:2px;background:var(--ink)}
        ::-webkit-scrollbar-thumb{background:var(--dust)}
        .BB{font-family:'Bebas Neue',sans-serif}
        .BC{font-family:'Barlow Condensed',sans-serif}
        .rv{opacity:0;transform:translateY(28px);transition:opacity .85s ease,transform .85s ease}
        .rv.d1{transition-delay:.1s}.rv.d2{transition-delay:.2s}
        .rv.d3{transition-delay:.3s}.rv.d4{transition-delay:.4s}.rv.d5{transition-delay:.5s}
        @keyframes tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes tsc{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes drop{0%{opacity:0;transform:translateY(64px) skewY(3deg)}100%{opacity:1;transform:translateY(0) skewY(0)}}
        @keyframes foot{0%{opacity:0;transform:translateY(28px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pip{0%,100%{opacity:1;transform:translateX(0)}50%{opacity:.35;transform:translateX(8px)}}
        .sb-nav-a:hover{color:var(--white)!important}
        .sb-nav-a::before{content:'';position:absolute;bottom:-3px;left:0;width:0;height:1px;background:var(--white);transition:width .25s}
        .sb-nav-a:hover::before{width:100%}
        .logo-hex{transition:transform .35s}
        .logo-wrap:hover .logo-hex{transform:rotate(30deg)}
        .sb-nav-cta:hover{background:var(--warn)!important;letter-spacing:.22em!important}
        .sb-feat-card:hover{background:#0e0e0e!important}
        .sb-step:hover{padding-left:50px!important}
        .sb-gw:hover{background:var(--card)!important}
        .sb-plan:hover{background:#0f0f0f!important}
        .sb-fill:hover{background:var(--warn)!important;letter-spacing:.22em!important}
        .sb-ghost:hover{color:var(--white)!important}
        .sb-ghost::after{transition:transform .2s;display:inline-block}
        .sb-ghost:hover::after{transform:translateX(5px)!important}
        .p-fill:hover{background:var(--warn)!important;letter-spacing:.2em!important}
        .p-out:hover{background:var(--card)!important;color:var(--white)!important}
        @media(max-width:900px){
          .sb-nav-links{display:none!important}
          .sb-feat-grid{grid-template-columns:1fr 1fr!important}
          .sb-plan-grid{grid-template-columns:1fr 1fr!important}
          .sb-how-grid{grid-template-columns:1fr!important;gap:48px!important}
          .sb-gw-wrap{grid-template-columns:1fr!important;gap:48px!important}
        }
        @media(max-width:600px){
          .sb-feat-grid,.sb-plan-grid{grid-template-columns:1fr!important}
          .sb-hero-foot{flex-direction:column!important;align-items:flex-start!important;gap:28px!important}
          .sb-hero-stats{justify-content:flex-start!important}
          .sb-tapes-wrap{width:100%!important;right:0!important}
        }
      `}</style>

      {/* ── LIGHTNING CANVAS ── */}
      <canvas ref={canvasRef} style={{ position:"fixed",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:1,opacity:0,transition:"opacity .08s" }} />

      {/* ─────────── NAV ─────────── */}
      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 52px",borderBottom:"1px solid rgba(255,255,255,.05)",background:"rgba(5,5,5,.92)",backdropFilter:"blur(16px)" }}>
        <a href="#" className="logo-wrap" style={{ display:"flex",alignItems:"center",gap:14,textDecoration:"none" }}>
          <div className="logo-hex" style={{ width:38,height:38,background:"var(--white)",clipPath:"polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
            <span className="BB" style={{ fontSize:19,color:"var(--ink)",lineHeight:1 }}>S</span>
          </div>
          <span className="BB" style={{ fontSize:22,letterSpacing:".1em",color:"var(--white)" }}>
            STORM <span style={{ WebkitTextStroke:"1px rgba(255,255,255,.3)",color:"transparent" }}>BOTS</span>
          </span>
        </a>
        <ul className="sb-nav-links" style={{ display:"flex",gap:40,listStyle:"none" }}>
          {(["#features:Recursos","#how:Como funciona","#plans:Planos","#gateways:Pagamentos"] as const).map(s => {
            const [href,label] = s.split(":");
            return (
              <li key={href}>
                <a href={href} className="BC sb-nav-a" style={{ position:"relative",fontWeight:700,fontSize:12,letterSpacing:".18em",textTransform:"uppercase",color:"var(--silver)",textDecoration:"none",transition:"color .2s" }}>{label}</a>
              </li>
            );
          })}
        </ul>
        <Link href="/api/auth/discord/login" className="BC sb-nav-cta" style={{ fontWeight:900,fontSize:12,letterSpacing:".18em",textTransform:"uppercase",color:"var(--ink)",background:"var(--white)",border:"none",padding:"10px 26px",clipPath:"polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)",cursor:"crosshair",transition:"all .2s",textDecoration:"none",display:"inline-block" }}>
          Começar grátis
        </Link>
      </nav>

      {/* ─────────── HERO ─────────── */}
      <section style={{ minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"flex-end",padding:"0 52px 80px",position:"relative",overflow:"hidden" }}>

        {/* tape stripes */}
        <div id="sb-tapes" className="sb-tapes-wrap" style={{ position:"absolute",top:0,right:-80,bottom:0,width:"52%",transform:"skewX(-5deg)",pointerEvents:"none",overflow:"hidden",zIndex:0 }}>
          {TAPE_ROWS.map((row, ri) => {
            const seg = row.words.join(" · ") + " · ";
            const rep = seg.repeat(14);
            return (
              <div key={ri} style={{ position:"absolute",left:"-10%",right:"-10%",height:58,top:`${6+ri*15}%`,background:"rgba(255,255,255,.022)",borderTop:"1px solid rgba(255,255,255,.04)",borderBottom:"1px solid rgba(255,255,255,.04)",display:"flex",alignItems:"center",overflow:"hidden",whiteSpace:"nowrap" }}>
                <span className="BB" style={{ fontSize:34,letterSpacing:".06em",color:"rgba(255,255,255,.048)",animation:`tsc ${row.dur}s linear infinite`,animationDirection:row.rev?"reverse":"normal",display:"inline-block",willChange:"transform" }}>{rep}{rep}</span>
              </div>
            );
          })}
        </div>

        {/* left vignette */}
        <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 80% at 0% 60%,rgba(5,5,5,.97) 28%,transparent 70%)",zIndex:1,pointerEvents:"none" }} />

        <div style={{ position:"relative",zIndex:2 }}>
          <div className="BC" style={{ fontWeight:700,fontSize:11,letterSpacing:".26em",textTransform:"uppercase",color:"var(--silver)",display:"flex",alignItems:"center",gap:14,marginBottom:20 }}>
            <span style={{ width:24,height:1,background:"var(--silver)",display:"inline-block",flexShrink:0 }} />
            Sistema de vendas para Discord
          </div>

          <h1 id="sb-title" className="BB" style={{ fontSize:"clamp(100px,15vw,210px)",lineHeight:.87,letterSpacing:".01em",color:"var(--white)",animation:"drop .9s cubic-bezier(.16,1,.3,1) both" }}>
            STORM<br/>
            <span style={{ WebkitTextStroke:"1px rgba(255,255,255,.2)",color:"transparent" }}>BOTS</span>
          </h1>

          <div className="sb-hero-foot" style={{ marginTop:44,display:"flex",alignItems:"flex-end",gap:60,flexWrap:"wrap",animation:"foot .9s .18s cubic-bezier(.16,1,.3,1) both" }}>
            <p style={{ maxWidth:340,fontSize:15,lineHeight:1.82,color:"var(--silver)",borderLeft:"2px solid var(--edge)",paddingLeft:22 }}>
              Venda produtos digitais no seu servidor Discord com automação completa, múltiplos gateways e painel profissional.
            </p>
            <div className="sb-hero-stats" style={{ display:"flex",gap:52 }}>
              {(["12K+:Servidores","R$8M:Processados","99.9%:Uptime"] as const).map(s => {
                const [n,l] = s.split(":");
                return (
                  <div key={l} style={{ textAlign:"right" }}>
                    <div className="BB" style={{ fontSize:52,lineHeight:1,letterSpacing:".02em",color:"var(--white)" }}>{n}</div>
                    <div className="BC" style={{ fontWeight:700,fontSize:11,letterSpacing:".18em",textTransform:"uppercase",color:"var(--silver)",marginTop:2 }}>{l}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="BC" style={{ position:"absolute",bottom:30,left:52,display:"flex",alignItems:"center",gap:12,zIndex:2,fontWeight:700,fontSize:10,letterSpacing:".24em",textTransform:"uppercase",color:"var(--dust)",animation:"pip 2.4s ease-in-out infinite" }}>
          scroll <span style={{ width:32,height:1,background:"var(--dust)",display:"inline-block" }} />
        </div>
      </section>

      {/* ─────────── TICKER ─────────── */}
      <div style={{ background:"var(--white)",overflow:"hidden",padding:"13px 0",borderTop:"1px solid rgba(255,255,255,.12)",borderBottom:"1px solid rgba(255,255,255,.12)" }}>
        <div style={{ display:"flex",width:"max-content",animation:"tick 24s linear infinite" }}>
          {[...TICKER,...TICKER].map((item, i) => (
            <span key={i} className="BB" style={{ fontSize:17,letterSpacing:".14em",color:"var(--ink)",padding:"0 36px",whiteSpace:"nowrap" }}>
              {item} <span style={{ fontSize:9,opacity:.35 }}>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ─────────── FEATURES ─────────── */}
      <section id="features" style={{ padding:"110px 52px",borderBottom:"1px solid var(--edge)" }}>
        <SL num="01" text="Recursos" />
        <h2 className="BB rv" style={{ fontSize:"clamp(56px,7.5vw,108px)",lineHeight:.88,color:"var(--white)",marginBottom:72 }}>
          TUDO QUE<br/><GH>VOCÊ PRECISA</GH>
        </h2>
        <div className="sb-feat-grid" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:"var(--edge)",border:"1px solid var(--edge)" }}>
          {FEATURES.map((f, i) => (
            <div key={i} className={`sb-feat-card rv ${DELAYS[i]}`} style={{ background:"var(--ink)",padding:"44px 36px",transition:"background .3s" }}>
              <div className="BB" style={{ fontSize:72,lineHeight:1,color:"rgba(255,255,255,.04)",marginBottom:20 }}>{f.g}</div>
              <div className="BC" style={{ fontWeight:700,fontSize:11,letterSpacing:".22em",textTransform:"uppercase",color:"var(--dust)",marginBottom:12 }}>Recurso {f.n}</div>
              <div className="BC" style={{ fontWeight:900,fontSize:21,letterSpacing:".05em",textTransform:"uppercase",color:"var(--white)",marginBottom:12 }}>{f.t}</div>
              <p style={{ fontSize:14,lineHeight:1.82,color:"var(--silver)" }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── HOW IT WORKS ─────────── */}
      <section id="how" style={{ padding:"110px 52px",borderBottom:"1px solid var(--edge)" }}>
        <div className="sb-how-grid" style={{ display:"grid",gridTemplateColumns:"1fr 1.2fr",gap:80,alignItems:"start" }}>
          <div>
            <SL num="02" text="Como funciona" />
            <h2 className="BB rv" style={{ fontSize:"clamp(56px,6.5vw,100px)",lineHeight:.88,color:"var(--white)" }}>
              CONFIGURE<br/><GH>EM MINUTOS</GH>
            </h2>
          </div>
          <div style={{ borderLeft:"1px solid var(--edge)",display:"flex",flexDirection:"column" }}>
            {STEPS.map((s, i) => (
              <div key={i} className={`sb-step rv ${DELAYS[i]}`} style={{ padding:"30px 0 30px 36px",borderBottom:"1px solid var(--edge)",position:"relative",transition:"padding-left .25s" }}>
                <div className="BB" style={{ fontSize:11,letterSpacing:".18em",color:"var(--dust)",marginBottom:10 }}>— PASSO {s.n}</div>
                <div className="BC" style={{ fontWeight:900,fontSize:26,textTransform:"uppercase",letterSpacing:".04em",color:"var(--white)",marginBottom:8 }}>{s.t}</div>
                <p style={{ fontSize:14,lineHeight:1.78,color:"var(--silver)" }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── PLANS ─────────── */}
      <section id="plans" style={{ padding:"110px 52px",borderBottom:"1px solid var(--edge)" }}>
        <div style={{ display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:60,gap:32,flexWrap:"wrap" }}>
          <h2 className="BB rv" style={{ fontSize:"clamp(56px,7.5vw,108px)",lineHeight:.88,color:"var(--white)" }}>
            PLANOS<br/><GH>& PREÇOS</GH>
          </h2>
          <p className="rv" style={{ fontSize:13,color:"var(--silver)",maxWidth:260,textAlign:"right",lineHeight:1.82 }}>
            Comece grátis. Atualize quando seu volume crescer. Sem contrato mínimo.
          </p>
        </div>
        <div className="sb-plan-grid" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"var(--edge)",border:"1px solid var(--edge)" }}>
          {PLANS.map((p, i) => (
            <div key={p.key} className={`sb-plan rv ${DELAYS[i]}`} style={{ background:p.hot?"var(--card)":"var(--ink)",padding:"36px 28px",display:"flex",flexDirection:"column",transition:"background .25s" }}>
              <div className="BC" style={{ fontWeight:700,fontSize:10,letterSpacing:".22em",textTransform:"uppercase",color:"var(--ink)",background:"var(--white)",display:"inline-block",padding:"4px 10px",marginBottom:26,alignSelf:"flex-start",visibility:p.hot?"visible":"hidden" }}>
                Mais popular
              </div>
              <div className="BB" style={{ fontSize:34,letterSpacing:".06em",color:"var(--white)",marginBottom:8 }}>{p.name}</div>
              <div className="BB" style={{ fontSize:60,letterSpacing:".01em",lineHeight:1,color:"var(--white)",marginBottom:4 }}>
                {p.price === null
                  ? "Grátis"
                  : <><sup style={{ fontSize:22,verticalAlign:"super" }}>R$</sup>{String(Math.floor(p.price))}<sub className="BC" style={{ fontSize:14,fontWeight:700,color:"var(--silver)",letterSpacing:".06em" }}>,{String(Math.round((p.price % 1)*100)).padStart(2,"0")}/mês</sub></>
                }
              </div>
              <div className="BC" style={{ fontWeight:700,fontSize:12,letterSpacing:".1em",color:"var(--silver)",marginBottom:30 }}>Taxa: {p.fee} por venda</div>
              <div style={{ height:1,background:"var(--edge)",margin:"0 -28px 28px" }} />
              <ul style={{ listStyle:"none",display:"flex",flexDirection:"column",gap:11,flex:1 }}>
                {p.on.map(f  => <li key={f}  className="BC" style={{ fontWeight:400,fontSize:13,color:"var(--chalk)",display:"flex",alignItems:"flex-start",gap:10,letterSpacing:".02em" }}><span style={{ flexShrink:0,marginTop:1,fontFamily:"monospace" }}>✓</span>{f}</li>)}
                {p.off.map(f => <li key={f}  className="BC" style={{ fontWeight:400,fontSize:13,color:"var(--dust)", display:"flex",alignItems:"flex-start",gap:10,letterSpacing:".02em" }}><span style={{ flexShrink:0,marginTop:1,fontFamily:"monospace" }}>—</span>{f}</li>)}
              </ul>
              <Link href="/api/auth/discord/login" className={p.hot?"p-fill":"p-out"} style={{
                marginTop:30,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,
                letterSpacing:".16em",textTransform:"uppercase",
                color:p.hot?"var(--ink)":"var(--silver)",
                background:p.hot?"var(--white)":"transparent",
                border:p.hot?"none":"1px solid var(--edge)",
                padding:p.hot?"13px 0":"12px 0",
                clipPath:p.hot?"polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)":"none",
                cursor:"crosshair",transition:"all .2s",
                textAlign:"center",display:"block",textDecoration:"none",
              }}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── GATEWAYS ─────────── */}
      <section id="gateways" style={{ padding:"110px 52px",borderBottom:"1px solid var(--edge)" }}>
        <div className="sb-gw-wrap" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:72,alignItems:"start" }}>
          <div>
            <SL num="03" text="Pagamentos" />
            <h2 className="BB rv" style={{ fontSize:"clamp(56px,6.5vw,100px)",lineHeight:.88,color:"var(--white)" }}>
              TODOS OS<br/><GH>GATEWAYS</GH>
            </h2>
            <p className="rv" style={{ fontSize:15,lineHeight:1.82,color:"var(--silver)",marginTop:24,maxWidth:380 }}>
              Aceite pagamentos com os maiores processadores do Brasil e do mundo. Webhooks automáticos e confirmação instantânea.
            </p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"var(--edge)",border:"1px solid var(--edge)" }}>
            {GWS.map((g, i) => (
              <div key={g.n} className={`sb-gw rv ${DELAYS[i%6]}`} style={{ background:"var(--ink)",padding:"24px 26px",display:"flex",flexDirection:"column",gap:5,transition:"background .2s" }}>
                <div className="BC" style={{ fontWeight:900,fontSize:18,textTransform:"uppercase",letterSpacing:".05em",color:"var(--white)" }}>{g.n}</div>
                <div className="BC" style={{ fontWeight:700,fontSize:11,letterSpacing:".1em",textTransform:"uppercase",color:"var(--dust)" }}>{g.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── CTA ─────────── */}
      <section id="cta" style={{ textAlign:"center",padding:"160px 52px",position:"relative",overflow:"hidden" }}>
        <div className="BB" style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:"clamp(120px,22vw,300px)",color:"rgba(255,255,255,.018)",pointerEvents:"none",whiteSpace:"nowrap",letterSpacing:".04em",lineHeight:1,zIndex:0 }}>STORM</div>
        <div style={{ position:"relative",zIndex:1 }}>
          <div className="BC" style={{ fontWeight:700,fontSize:11,letterSpacing:".26em",textTransform:"uppercase",color:"var(--dust)",marginBottom:18 }}>Comece hoje mesmo</div>
          <h2 className="BB" style={{ fontSize:"clamp(64px,10vw,130px)",lineHeight:.87,color:"var(--white)",marginBottom:30 }}>
            PRONTO PARA<br/><GH>VENDER?</GH>
          </h2>
          <p style={{ fontSize:15,color:"var(--silver)",marginBottom:52 }}>Grátis para começar. Sem cartão de crédito. Sem burocracia.</p>
          <div style={{ display:"flex",gap:20,justifyContent:"center",alignItems:"center",flexWrap:"wrap" }}>
            <Link href="/api/auth/discord/login" className="BC sb-fill" style={{ fontWeight:900,fontSize:14,letterSpacing:".18em",textTransform:"uppercase",color:"var(--ink)",background:"var(--white)",border:"none",padding:"16px 44px",clipPath:"polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)",cursor:"crosshair",transition:"all .2s",textDecoration:"none",display:"inline-block" }}>
              Criar conta grátis
            </Link>
            <a href="https://discord.gg/stormbots" target="_blank" rel="noreferrer" className="BC sb-ghost" style={{ fontWeight:700,fontSize:13,letterSpacing:".16em",textTransform:"uppercase",color:"var(--silver)",textDecoration:"none",display:"flex",alignItems:"center",gap:10,transition:"color .2s" }}>
              Entrar no Discord <span>→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─────────── FOOTER ─────────── */}
      <footer style={{ padding:"36px 52px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:20,borderTop:"1px solid var(--edge)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:16 }}>
          <span className="BB" style={{ fontSize:20,letterSpacing:".1em",color:"var(--white)" }}>STORM BOTS</span>
          <span className="BC" style={{ fontWeight:700,fontSize:11,letterSpacing:".14em",textTransform:"uppercase",color:"var(--dust)",borderLeft:"1px solid var(--edge)",paddingLeft:16 }}>Vendas no Discord</span>
        </div>
        <ul style={{ display:"flex",gap:28,listStyle:"none" }}>
          {(["Termos:#","Privacidade:#","Suporte:#","Discord:https://discord.gg/stormbots"] as const).map(s => {
            const [l,h] = s.split(":");
            return (
              <li key={l}>
                <a href={h} className="BC" style={{ fontWeight:700,fontSize:12,letterSpacing:".12em",textTransform:"uppercase",color:"var(--dust)",textDecoration:"none",transition:"color .2s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color="var(--white)"}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color="var(--dust)"}
                >{l}</a>
              </li>
            );
          })}
        </ul>
        <span className="BC" style={{ fontWeight:400,fontSize:11,letterSpacing:".1em",textTransform:"uppercase",color:"var(--edge)" }}>© 2025 Storm Bots</span>
      </footer>
    </>
  );
}

/* ── helpers ── */
function SL({ num, text }: { num:string; text:string }) {
  return (
    <div className="BC" style={{ fontWeight:700,fontSize:11,letterSpacing:".26em",textTransform:"uppercase",color:"var(--dust)",display:"flex",alignItems:"center",gap:12,marginBottom:60 }}>
      <span style={{ width:18,height:1,background:"var(--dust)",display:"inline-block",flexShrink:0 }} />
      <span style={{ color:"rgba(255,255,255,.1)",marginRight:6 }}>{num}</span>
      {text}
    </div>
  );
}
function GH({ children }: { children: React.ReactNode }) {
  return <span style={{ WebkitTextStroke:"1px rgba(255,255,255,.18)",color:"transparent",display:"block" }}>{children}</span>;
}
