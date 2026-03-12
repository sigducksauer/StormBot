/**
 * apps/bot/src/commands/admin.js
 * Comandos admin V2 — painel, pedidos, relatório, produtos, cupons, clientes
 */
const {
  SlashCommandBuilder, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const api = require("../utils/api");
const { COLORS, ICONS, BRAND, formatBRL, formatDate, shortId } = require("../embeds/theme");
const { buildErrorEmbed } = require("../embeds/checkout");

const STATUS_EMOJI = { pending: "🟡", paid: "💚", delivered: "✅", expired: "⚫", failed: "❌", refunded: "🔵" };
const STATUS_PT    = { pending: "Pendente", paid: "Pago", delivered: "Entregue", expired: "Expirado", failed: "Falhou", refunded: "Reembolsado" };

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription(`${ICONS.gear} Comandos administrativos do Storm Bots`)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(s => s.setName("painel").setDescription("🖥️ Link do painel de controle"))

    .addSubcommand(s => s
      .setName("pedidos")
      .setDescription("📦 Pedidos recentes do servidor")
      .addStringOption(o => o.setName("status").setDescription("Filtrar status").setRequired(false)
        .addChoices(
          { name: "Pendentes",    value: "pending"   },
          { name: "Pagos",        value: "paid"      },
          { name: "Entregues",    value: "delivered" },
          { name: "Expirados",    value: "expired"   },
          { name: "Reembolsados", value: "refunded"  },
        )
      )
    )

    .addSubcommand(s => s
      .setName("relatorio")
      .setDescription("📊 Resumo de vendas")
      .addStringOption(o => o.setName("periodo").setDescription("Período").setRequired(false)
        .addChoices(
          { name: "Hoje",    value: "1d"  },
          { name: "7 dias",  value: "7d"  },
          { name: "30 dias", value: "30d" },
          { name: "90 dias", value: "90d" },
        )
      )
    )

    .addSubcommand(s => s
      .setName("produto")
      .setDescription("📦 Gerenciar produtos")
      .addStringOption(o => o.setName("acao").setDescription("Ação").setRequired(true)
        .addChoices(
          { name: "📋 Listar",         value: "list"   },
          { name: "📦 Ver estoques",   value: "stock"  },
        )
      )
    )

    .addSubcommand(s => s
      .setName("cliente")
      .setDescription("👤 Buscar cliente")
      .addStringOption(o => o.setName("discord_id").setDescription("ID Discord do cliente").setRequired(true))
    )

    .addSubcommand(s => s
      .setName("cupom")
      .setDescription("🎟️ Listar cupons ativos")
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    const handlers = {
      painel:   cmdPainel,
      pedidos:  cmdPedidos,
      relatorio:cmdRelatorio,
      produto:  cmdProduto,
      cliente:  cmdCliente,
      cupom:    cmdCupom,
    };

    const fn = handlers[sub];
    if (fn) await fn(interaction);
  },
};

// ── /admin painel ─────────────────────────────────────────
async function cmdPainel(interaction) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle("🖥️ Painel Storm Bots")
    .setDescription(
      "Acesse o painel web para gerenciar sua loja completa.\n\n" +
      `**${ICONS.product}** Adicionar e editar produtos\n` +
      `**${ICONS.card}** Configurar gateways de pagamento\n` +
      `**📊** Analytics e relatórios detalhados\n` +
      `**⚙️** Personalizar embeds e automações\n` +
      `**👥** Gerenciar equipe e permissões`
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Abrir Painel").setStyle(ButtonStyle.Link).setURL(BRAND.panel).setEmoji("🖥️"),
    new ButtonBuilder().setLabel("Suporte").setStyle(ButtonStyle.Link).setURL(BRAND.support).setEmoji("💬"),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ── /admin pedidos ────────────────────────────────────────
async function cmdPedidos(interaction) {
  const statusFilter = interaction.options.getString("status");

  let data;
  try {
    data = await api.get(
      `/orders?limit=10${statusFilter ? `&status=${statusFilter}` : ""}`,
      interaction.guildId
    );
  } catch {
    return interaction.editReply({ embeds: [buildErrorEmbed("Erro ao buscar pedidos.")] });
  }

  const orders = data.orders || data || [];
  if (!orders.length) {
    return interaction.editReply({ embeds: [buildErrorEmbed("Nenhum pedido encontrado.")] });
  }

  const label = statusFilter ? STATUS_PT[statusFilter] || statusFilter : "Recentes";

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`📦 Pedidos ${label}`)
    .setDescription(`Exibindo últimos **${orders.length}** pedido(s)${data.total ? ` de ${data.total} no total` : ""}.`)
    .setFooter({ text: `${BRAND.footer} · Admin` })
    .setTimestamp();

  for (const o of orders.slice(0, 8)) {
    const emoji = STATUS_EMOJI[o.status] || "❓";
    const st    = STATUS_PT[o.status]    || o.status;
    const date  = o.created_at ? new Date(o.created_at).toLocaleDateString("pt-BR") : "—";
    embed.addFields({
      name:   `${emoji} #${shortId(o.id)} — ${st}`,
      value:  `${ICONS.money} **${formatBRL(o.total)}** · <@${o.customer_discord_id || "?"}> · 📅 ${date}`,
      inline: false,
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Ver todos no painel").setStyle(ButtonStyle.Link).setURL(BRAND.panel).setEmoji("🖥️")
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ── /admin relatorio ──────────────────────────────────────
async function cmdRelatorio(interaction) {
  const period = interaction.options.getString("periodo") || "30d";

  let summary;
  try {
    summary = await api.get(`/analytics/summary?period=${period}`, interaction.guildId);
  } catch {
    return interaction.editReply({ embeds: [buildErrorEmbed("Erro ao buscar relatório.")] });
  }

  const labels = { "1d": "hoje", "7d": "7 dias", "30d": "30 dias", "90d": "90 dias" };

  const convRate = summary.conversion_rate || 0;
  const convBar  = "█".repeat(Math.round(convRate / 10)) + "░".repeat(10 - Math.round(convRate / 10));

  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`📊 Relatório — ${labels[period] || period}`)
    .addFields(
      { name: `${ICONS.money} Receita Bruta`,     value: formatBRL(summary.gross_revenue), inline: true },
      { name: "✅ Receita Líquida",               value: formatBRL(summary.net_revenue),   inline: true },
      { name: "⚡ Taxas Storm",                   value: formatBRL(summary.total_fees),    inline: true },
      { name: "📦 Total Pedidos",                 value: String(summary.total_orders || 0), inline: true },
      { name: `${ICONS.cart} Ticket Médio`,       value: formatBRL(summary.avg_ticket),    inline: true },
      { name: "📈 Conversão",                     value: `${convRate}%\n\`${convBar}\``,   inline: true },
    )
    .setFooter({ text: `${BRAND.footer} · Analytics` })
    .setTimestamp();

  if (summary.top_products?.length) {
    const top = summary.top_products
      .slice(0, 3)
      .map((p, i) => `${["🥇","🥈","🥉"][i]} **${p.name}** — ${p.sales} vendas · ${formatBRL(p.revenue)}`)
      .join("\n");
    embed.addFields({ name: `${ICONS.fire} Top Produtos`, value: top, inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

// ── /admin produto ────────────────────────────────────────
async function cmdProduto(interaction) {
  const action = interaction.options.getString("acao");

  let products;
  try {
    const res = await api.get("/products?active=true&limit=50", interaction.guildId);
    products  = Array.isArray(res) ? res : (res?.products ?? []);
  } catch {
    return interaction.editReply({ embeds: [buildErrorEmbed("Erro ao buscar produtos.")] });
  }

  if (!products.length) {
    return interaction.editReply({ embeds: [buildErrorEmbed("Nenhum produto cadastrado.")] });
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setFooter({ text: `${BRAND.footer} · Admin` })
    .setTimestamp();

  if (action === "stock") {
    embed.setTitle("📦 Estoques");
    embed.setDescription(`Total: **${products.length}** produtos`);
    for (const p of products.slice(0, 15)) {
      const stock = p.stock === -1 ? "∞ Ilimitado" : p.stock === 0 ? `${ICONS.dot_off} Esgotado` : `${ICONS.dot_on} ${p.stock} unid.`;
      const alert = p.stock !== -1 && p.stock <= (p.stock_alert || 5) && p.stock > 0 ? ` ${ICONS.warning}` : "";
      embed.addFields({ name: `${p.name}${alert}`, value: `${formatBRL(p.price)} · ${stock}`, inline: true });
    }
  } else {
    embed.setTitle("📦 Produtos Ativos");
    embed.setDescription(`Total: **${products.length}** produto(s)`);
    for (const p of products.slice(0, 15)) {
      const typeEmoji = { key: ICONS.key, role: ICONS.role, digital: "📄", channel: "📺" }[p.product_type] || "📦";
      embed.addFields({ name: `${typeEmoji} ${p.name}`, value: `${formatBRL(p.price)} · ID: \`${shortId(p.id)}\``, inline: true });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

// ── /admin cliente ────────────────────────────────────────
async function cmdCliente(interaction) {
  const discordId = interaction.options.getString("discord_id").replace(/\D/g, "");

  let customer;
  try {
    customer = await api.get(`/customers?discord_id=${discordId}`, interaction.guildId);
  } catch {
    return interaction.editReply({ embeds: [buildErrorEmbed("Cliente não encontrado.")] });
  }

  if (!customer) {
    return interaction.editReply({ embeds: [buildErrorEmbed("Cliente não encontrado no banco de dados.")] });
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`👤 Cliente: ${customer.username || discordId}`)
    .addFields(
      { name: "Discord",          value: `<@${discordId}>`,                     inline: true },
      { name: "Total gasto",      value: formatBRL(customer.total_spent),        inline: true },
      { name: "Nº de pedidos",    value: String(customer.total_orders || 0),     inline: true },
      { name: "Primeiro pedido",  value: customer.first_order ? formatDate(customer.first_order) : "—", inline: true },
      { name: "Último pedido",    value: customer.last_order  ? formatDate(customer.last_order)  : "—", inline: true },
      { name: "Status",           value: customer.is_blacklisted ? `${ICONS.dot_off} Bloqueado` : `${ICONS.dot_on} Ativo`, inline: true },
    )
    .setFooter({ text: `${BRAND.footer} · Admin` })
    .setTimestamp();

  if (customer.notes) {
    embed.addFields({ name: "📝 Notas", value: customer.notes.slice(0, 200), inline: false });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Ver no painel").setStyle(ButtonStyle.Link).setURL(`${BRAND.panel}/dashboard`).setEmoji("🖥️")
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ── /admin cupom ──────────────────────────────────────────
async function cmdCupom(interaction) {
  let coupons;
  try {
    const res = await api.get("/coupons?active=true&limit=20", interaction.guildId);
    coupons   = Array.isArray(res) ? res : (res?.coupons ?? []);
  } catch {
    return interaction.editReply({ embeds: [buildErrorEmbed("Erro ao buscar cupons.")] });
  }

  if (!coupons.length) {
    return interaction.editReply({ embeds: [buildErrorEmbed("Nenhum cupom ativo.")] });
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.gold)
    .setTitle("🎟️ Cupons Ativos")
    .setDescription(`Total: **${coupons.length}** cupom(s)`)
    .setFooter({ text: `${BRAND.footer} · Admin` })
    .setTimestamp();

  for (const c of coupons.slice(0, 10)) {
    const discount = c.discount_type === "percent"
      ? `${c.discount_value}% OFF`
      : `${formatBRL(c.discount_value)} OFF`;
    const uses = c.max_uses ? `${c.current_uses || 0}/${c.max_uses}` : `${c.current_uses || 0}/∞`;
    embed.addFields({
      name:   `\`${c.code}\` — ${discount}`,
      value:  `Usos: ${uses}${c.expires_at ? ` · Expira: ${formatDate(c.expires_at)}` : ""}`,
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
