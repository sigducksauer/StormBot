/**
 * apps/bot/src/internal/routes.js
 * Rotas internas — chamadas pela API para executar ações no Discord
 */
const express = require("express");
const router  = express.Router();
const secrets = require("crypto");
const { EmbedBuilder } = require("discord.js");
const {
  buildDmKeyEmbed, buildDmRoleEmbed, buildDmChannelEmbed,
  buildDmFileEmbed, buildSuccessEmbed,
} = require("../embeds/checkout");
const { COLORS, ICONS, BRAND, formatBRL, shortId } = require("../embeds/theme");

// Callbacks de pagamento pendentes: orderId → { resolve, reject, timer }
const paymentCallbacks = new Map();

let _client = null;
function setClient(client) { _client = client; }

// ── Auth interna ──────────────────────────────────────────
router.use((req, res, next) => {
  const secret   = req.headers["x-internal-secret"] || "";
  const expected = process.env.API_INTERNAL_SECRET  || "";
  if (!expected || !secrets.timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
    return res.status(401).json({ error: "Não autorizado." });
  }
  next();
});

// ── Pagamento confirmado (push da API) ────────────────────
router.post("/payment_confirmed", (req, res) => {
  const { order_id, status } = req.body;
  const cb = paymentCallbacks.get(order_id);
  if (cb) {
    clearTimeout(cb.timer);
    paymentCallbacks.delete(order_id);
    cb.resolve({ order_id, status });
  }
  res.json({ success: true });
});

// ── Enviar DM ─────────────────────────────────────────────
router.post("/send_dm", async (req, res) => {
  const { discord_id, type, product_name, key_value, role_name, channel_name, file_url, order_id, expires_at } = req.body;

  try {
    const user = await _client.users.fetch(String(discord_id));
    const product = { name: product_name };
    let embed, files = [];

    switch (type) {
      case "key_delivery":
        embed = buildDmKeyEmbed(product, key_value, order_id);
        break;
      case "role_delivery":
        embed = buildDmRoleEmbed(product, role_name || "VIP", order_id, expires_at);
        break;
      case "channel_delivery":
        embed = buildDmChannelEmbed(product, channel_name || "canal", order_id);
        break;
      case "file_delivery":
        embed = buildDmFileEmbed(product, order_id);
        if (file_url) files = [{ attachment: file_url, name: "entrega.zip" }];
        break;
      default:
        embed = buildSuccessEmbed({}, { id: order_id, total: 0 }, product);
    }

    await user.send({ embeds: [embed], ...(files.length ? { files } : {}) });
    res.json({ success: true });
  } catch (err) {
    console.error(`[DM ERROR] ${discord_id}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Dar cargo ─────────────────────────────────────────────
router.post("/give_role", async (req, res) => {
  const { guild_id, discord_id, role_id, duration_days, order_id } = req.body;

  try {
    const guild  = await _client.guilds.fetch(String(guild_id));
    const member = await guild.members.fetch(String(discord_id));
    const role   = await guild.roles.fetch(String(role_id));

    if (!role) return res.status(404).json({ error: "Cargo não encontrado." });

    await member.roles.add(role, `Storm Bots — Pedido #${shortId(order_id)}`);

    if (duration_days && duration_days > 0) {
      const ms = duration_days * 24 * 60 * 60 * 1000;
      setTimeout(async () => {
        try { await member.roles.remove(role, "Storm Bots — Cargo expirado"); } catch {}
      }, ms);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[ROLE ERROR]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Dar acesso a canal ────────────────────────────────────
router.post("/grant_channel", async (req, res) => {
  const { guild_id, discord_id, channel_id, order_id } = req.body;

  try {
    const guild   = await _client.guilds.fetch(String(guild_id));
    const channel = await guild.channels.fetch(String(channel_id));
    const member  = await guild.members.fetch(String(discord_id));

    await channel.permissionOverwrites.edit(member, {
      ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
    }, { reason: `Storm Bots — Pedido #${shortId(order_id)}` });

    res.json({ success: true });
  } catch (err) {
    console.error("[CHANNEL ERROR]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Log de venda no canal do servidor ─────────────────────
router.post("/log_sale", async (req, res) => {
  const { guild_id, log_channel_id, customer_username, product_name, total, order_id, gateway } = req.body;
  if (!log_channel_id) return res.json({ success: true, skipped: true });

  try {
    const guild   = await _client.guilds.fetch(String(guild_id));
    const channel = await guild.channels.fetch(String(log_channel_id));

    const gwLabel = { mercadopago: "Mercado Pago", stripe: "Stripe", pix_manual: "Pix Manual", asaas: "Asaas" }[gateway] || gateway || "—";

    const embed = new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle(`${ICONS.money} Nova venda!`)
      .addFields(
        { name: `${ICONS.product} Produto`,  value: product_name,            inline: true },
        { name: `${ICONS.money} Valor`,      value: formatBRL(total),        inline: true },
        { name: "💳 Gateway",                value: gwLabel,                  inline: true },
        { name: "👤 Cliente",                value: customer_username,        inline: true },
        { name: "🔖 Pedido",                 value: `\`#${shortId(order_id)}\``, inline: true },
        { name: "\u200b",                    value: "\u200b",                 inline: true },
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    res.json({ success: true });
  } catch (err) {
    console.error("[LOG SALE ERROR]:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Remoção de cargo expirado ─────────────────────────────
router.post("/remove_role", async (req, res) => {
  const { guild_id, discord_id, role_id, order_id } = req.body;
  try {
    const guild  = await _client.guilds.fetch(String(guild_id));
    const member = await guild.members.fetch(String(discord_id));
    const role   = await guild.roles.fetch(String(role_id));
    if (role) await member.roles.remove(role, `Storm Bots — Expirado #${shortId(order_id)}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Registrar callback de pagamento ──────────────────────
function waitForPayment(orderId, timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      paymentCallbacks.delete(orderId);
      reject(new Error("timeout"));
    }, timeoutMs);
    paymentCallbacks.set(orderId, { resolve, reject, timer });
  });
}

module.exports = { router, setClient, waitForPayment };
