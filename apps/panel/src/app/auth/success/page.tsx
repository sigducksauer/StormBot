"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthSuccess() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Passo 1: confirma login
    const t1 = setTimeout(() => setStep(1), 400);
    // Passo 2: redireciona
    const t2 = setTimeout(() => router.push("/servers"), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07050f",
      backgroundImage: "radial-gradient(circle, rgba(120,50,255,0.14) 1px, transparent 1px)",
      backgroundSize: "28px 28px",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{ textAlign: "center", maxWidth: 320, width: "100%" }}>

        {/* Ícone animado */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "linear-gradient(135deg,rgba(124,58,237,.2),rgba(168,85,247,.2))",
          border: "1px solid rgba(168,85,247,.35)",
          margin: "0 auto 24px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .4s ease",
          transform: step >= 1 ? "scale(1)" : "scale(0.8)",
          opacity: step >= 1 ? 1 : 0.5,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L19 7" stroke="#a855f7" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 24, strokeDashoffset: step >= 1 ? 0 : 24, transition: "stroke-dashoffset .5s ease .2s" }}
            />
          </svg>
        </div>

        {/* Texto */}
        <h2 style={{
          fontSize: 20, fontWeight: 800,
          fontFamily: "Syne, sans-serif",
          background: "linear-gradient(135deg,#fff,#c4bcd8)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: 8,
          opacity: step >= 1 ? 1 : 0,
          transform: step >= 1 ? "translateY(0)" : "translateY(8px)",
          transition: "all .4s ease .1s",
        }}>
          Login realizado com sucesso!
        </h2>

        <p style={{
          fontSize: 14, color: "#8b7aac", marginBottom: 28,
          opacity: step >= 1 ? 1 : 0,
          transition: "opacity .4s ease .2s",
        }}>
          Redirecionando para o painel...
        </p>

        {/* Progress bar */}
        <div style={{
          height: 2, background: "rgba(124,58,237,.15)",
          borderRadius: 2, overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            background: "linear-gradient(90deg,#7c3aed,#a855f7)",
            borderRadius: 2,
            width: step >= 1 ? "100%" : "0%",
            transition: "width 1.4s ease .3s",
          }} />
        </div>
      </div>
    </div>
  );
}
