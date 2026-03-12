import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Storm Bots — Painel de Controle",
  description: "Sistema profissional de vendas para Discord. Gerencie produtos, pedidos e pagamentos.",
  keywords: "discord bot, vendas discord, storm bots, loja discord",
  robots: "noindex, nofollow", // painel não deve ser indexado
  openGraph: {
    title: "Storm Bots — Painel",
    description: "Sistema profissional de vendas para Discord.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
