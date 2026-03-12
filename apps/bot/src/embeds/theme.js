/**
 * apps/bot/src/embeds/theme.js
 * Sistema de cores e constantes visuais do Storm Bots
 */

const COLORS = {
  primary:   0x7c3aed,  // roxo Storm
  success:   0x10b981,  // verde
  warning:   0xf59e0b,  // âmbar
  danger:    0xef4444,  // vermelho
  info:      0x3b82f6,  // azul
  neutral:   0x6b7280,  // cinza
  pix:       0x00c853,  // verde Pix
  stripe:    0x635bff,  // roxo Stripe
  mp:        0x009ee3,  // azul Mercado Pago
  gold:      0xf59e0b,  // dourado (premium)
  dark:      0x1e1e2e,  // fundo escuro
};

const ICONS = {
  store:    "🛒",
  product:  "📦",
  cart:     "🛍️",
  pix:      "⚡",
  card:     "💳",
  success:  "✅",
  error:    "❌",
  warning:  "⚠️",
  info:     "ℹ️",
  key:      "🔑",
  role:     "🎭",
  lock:     "🔒",
  timer:    "⏱️",
  money:    "💰",
  chart:    "📊",
  gear:     "⚙️",
  bell:     "🔔",
  star:     "⭐",
  fire:     "🔥",
  check:    "✓",
  arrow:    "→",
  dot_on:   "🟢",
  dot_off:  "🔴",
  dot_warn: "🟡",
};

const BRAND = {
  name:    "Storm Bots",
  footer:  "Storm Bots • Sistema de Vendas",
  support: process.env.SUPPORT_URL || "https://discord.gg/stormbots",
  panel:   process.env.PANEL_URL   || "https://stormbots.com.br",
};

function parseColor(hex, fallback = COLORS.primary) {
  if (!hex) return fallback;
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return isNaN(n) ? fallback : n;
}

function interpolate(text = "", vars = {}) {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function formatBRL(value) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function shortId(id = "") {
  return id.slice(0, 8).toUpperCase();
}

module.exports = { COLORS, ICONS, BRAND, parseColor, interpolate, formatBRL, formatDate, shortId };
