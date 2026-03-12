/**
 * apps/bot/src/commands/checkout.js
 * Fluxo de checkout V2 — seleção de gateway, pagamento, push notification
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ComponentType,
} = require("discord.js");
const api = require("../utils/api");
const {
  buildCheckoutEmbed, buildPixEmbed, buildWaitingEmbed,
  buildSuccessEmbed, buildErrorEmbed, buildLinkPaymentEmbed,
} = require("../embeds/checkout");
const { COLORS, ICONS, BRAND, formatBRL } = require("../embeds/theme");

const PAYMENT_TIMEOUT = 15 * 60 * 1000; // 15 minutos

let _routes = null;
function getRoutes() {
  if (!_routes) _routes = require("../internal/routes");
  return _routes;
}

// ── Entrada principal ─────────────────────────────────────
async function startCheckout(interaction, productId) {
  await interaction.deferUpdate();

  const guildId = interaction.guildId;
  let product, gateways, embedConfig;

  try {
    [product, gateways, embedConfig] = await Promise.all([
      api.get(`/products/${productId}`, guildId),
      api.get(`/gateways?server_discord_id=${guildId}&active=true`, guildId),
      api.get(`/embeds/${guildId}/checkout`, guildId).catch(() => ({})),
    ]);
  } catch {
    return interaction.editReply({
      embeds: [buildErrorEmbed("Erro ao carregar produto.", `Use ${ICONS.store} /loja para tentar novamente.`)],
      components: [],
    });
  }

  if (!product) {
    return interaction.editReply({
      embeds: [buildErrorEmbed("Produto não encontrado.")],
      components: [],
    });
  }

  if (product.stock === 0) {
    return interaction.editReply({
      embeds: [buildErrorEmbed("Este produto está sem estoque.", "Verifique novamente mais tarde.")],
      components: [],
    });
  }

  // ── Verificar blacklist ───────────────────────────────
  try {
    const bl = await api.post("/blacklist/check", {
      discord_id: parseInt(interaction.user.id),
    }, guildId);
    if (bl?.is_blocked) {
      return interaction.editReply({
        embeds: [buildErrorEmbed(
          "Você não tem permissão para comprar neste servidor.",
          bl.reason ? `Motivo: ${bl.reason}` : null
        )],
        components: [],
      });
    }
  } catch { /* não bloquear se blacklist falhar */ }

  // ── Montar opções de gateway ──────────────────────────
  const gwList = Array.isArray(gateways) ? gateways : (gateways?.gateways ?? []);
  const options = [];

  if (gwList.find(g => g.gateway_type === "mercadopago")) {
    options.push({ label: "Pix (Mercado Pago)", value: "mp_pix",  description: "Aprovação instantânea", emoji: "⚡" });
    options.push({ label: "Cartão de Crédito",  value: "mp_card", description: "Via Mercado Pago",      emoji: "💳" });
  }
  if (gwList.find(g => g.gateway_type === "pix_manual")) {
    options.push({ label: "Pix Manual",          value: "pix_manual", description: "Confirmação pelo vendedor", emoji: "📲" });
  }
  if (gwList.find(g => g.gateway_type === "stripe")) {
    options.push({ label: "Cartão Internacional", value: "stripe", description: "Via Stripe", emoji: "🌐" });
  }
  if (gwList.find(g => g.gateway_type === "asaas")) {
    options.push({ label: "Pix (Asaas)", value: "asaas_pix", description: "Via Asaas", emoji: "⚡" });
  }

  if (!options.length) {
    return interaction.editReply({
      embeds: [buildErrorEmbed(
        "Nenhuma forma de pagamento configurada.",
        `O administrador precisa configurar um gateway no painel.`
      )],
      components: [],
    });
  }

  const embed  = buildCheckoutEmbed(embedConfig, product);
  const selRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`pay_method_${productId}`)
      .setPlaceholder(`${ICONS.card} Escolha a forma de pagamento...`)
      .addOptions(options)
  );

  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("cancel_checkout")
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("✖️")
  );

  await interaction.editReply({ embeds: [embed], components: [selRow, cancelRow] });

  const collector = interaction.channel.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: i => i.user.id === interaction.user.id && i.customId.startsWith("pay_method_"),
    time:  5 * 60 * 1000,
    max:   1,
  });

  collector.on("collect", async (sel) => {
    await processPayment(sel, product, sel.values[0], guildId, embedConfig);
  });

  collector.on("end", (col) => {
    if (col.size === 0) {
      interaction.editReply({
        embeds: [buildErrorEmbed("Tempo esgotado.", `Use ${ICONS.store} /loja para recomeçar.`)],
        components: [],
      }).catch(() => {});
    }
  });
}

// ── Processar pagamento ───────────────────────────────────
async function processPayment(interaction, product, method, guildId, embedConfig) {
  await interaction.deferUpdate();

  const gatewayMap = {
    mp_pix:    { payment_method: "pix",         gateway: "mercadopago" },
    mp_card:   { payment_method: "credit_card", gateway: "mercadopago" },
    pix_manual:{ payment_method: "pix",         gateway: "pix_manual"  },
    stripe:    { payment_method: "credit_card", gateway: "stripe"      },
    asaas_pix: { payment_method: "pix",         gateway: "asaas"       },
  };

  const gw = gatewayMap[method] || { payment_method: "pix", gateway: "pix_manual" };

  let order;
  try {
    order = await api.post("/orders", {
      customer_discord_id: parseInt(interaction.user.id),
      customer_username:   interaction.user.username,
      items:               [{ product_id: product.id, quantity: 1 }],
      payment_method:      gw.payment_method,
      gateway:             gw.gateway,
    }, guildId);
  } catch (err) {
    const msg = err.response?.data?.detail || err.message || "Erro ao criar pedido.";
    return interaction.editReply({
      embeds: [buildErrorEmbed(msg, "Tente novamente ou entre em contato com o suporte.")],
      components: [],
    });
  }

  if (method === "mp_pix" || method === "pix_manual" || method === "asaas_pix") {
    await showPixFlow(interaction, order, product, embedConfig);
  } else if (method === "stripe") {
    const url = order.metadata_?.stripe_url || BRAND.panel;
    await showLinkPayment(interaction, order, product, "Stripe", url, COLORS.stripe);
  } else {
    const url = order.metadata_?.mp_url || BRAND.panel;
    await showLinkPayment(interaction, order, product, "Mercado Pago", url, COLORS.mp);
  }
}

// ── Fluxo Pix ────────────────────────────────────────────
async function showPixFlow(interaction, order, product, embedConfig) {
  const pixEmbed = await buildPixEmbed(embedConfig, order, product);

  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cancel_order_${order.id}`)
      .setLabel("Cancelar Pedido")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("✖️")
  );

  await interaction.editReply({ embeds: [pixEmbed], components: [cancelRow] });

  // Aguarda push notification da API
  try {
    const routes = getRoutes();
    await routes.waitForPayment(order.id, PAYMENT_TIMEOUT);
    const successEmbed = buildSuccessEmbed(embedConfig, order, product);
    await interaction.editReply({ embeds: [successEmbed], components: [] });
  } catch (err) {
    if (err.message === "timeout") {
      await interaction.editReply({
        embeds: [buildErrorEmbed(
          "O tempo de pagamento expirou.",
          `Use ${ICONS.store} /loja para iniciar um novo pedido.`
        )],
        components: [],
      }).catch(() => {});
    }
  }
}

// ── Fluxo Link (Stripe / MP Cartão) ──────────────────────
async function showLinkPayment(interaction, order, product, gatewayName, url, color) {
  const embed = buildLinkPaymentEmbed(order, product, gatewayName, color);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(`Pagar com ${gatewayName}`)
      .setStyle(ButtonStyle.Link)
      .setURL(url)
      .setEmoji(ICONS.card),
    new ButtonBuilder()
      .setCustomId(`cancel_order_${order.id}`)
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("✖️")
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

module.exports = { startCheckout };
