/**
 * apps/bot/src/commands/meus-pedidos.js
 * Histórico de pedidos do cliente V2
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const api = require("../utils/api");
const { COLORS, ICONS, BRAND, formatBRL, formatDate, shortId } = require("../embeds/theme");
const { buildErrorEmbed } = require("../embeds/checkout");

const STATUS_EMOJI = { pending:"🟡", paid:"💚", delivered:"✅", refunded:"🔵", expired:"⚫", failed:"❌" };
const STATUS_PT    = { pending:"Pendente", paid:"Pago", delivered:"Entregue", refunded:"Reembolsado", expired:"Expirado", failed:"Falhou" };

module.exports = {
  data: new SlashCommandBuilder()
    .setName("meus-pedidos")
    .setDescription("📋 Veja seus pedidos recentes neste servidor"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    let data;
    try {
      data = await api.get(
        `/orders?customer_discord_id=${interaction.user.id}&limit=10`,
        interaction.guildId
      );
    } catch {
      return interaction.editReply({ embeds: [buildErrorEmbed("Não foi possível buscar seus pedidos.")] });
    }

    const orders = Array.isArray(data) ? data : (data?.orders ?? []);

    if (!orders.length) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.neutral)
        .setTitle("📋 Seus Pedidos")
        .setDescription(`Você ainda não realizou nenhum pedido neste servidor.\n\nUse ${ICONS.store} \`/loja\` para começar!`)
        .setFooter({ text: BRAND.footer })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle("📋 Seus Pedidos")
      .setDescription(`Últimos **${orders.length}** pedido(s) neste servidor.`)
      .setFooter({ text: `${BRAND.footer} · Use /loja para comprar` })
      .setTimestamp();

    // Estatísticas rápidas
    const totalGasto = orders.reduce((s, o) => s + (o.status === "delivered" || o.status === "paid" ? Number(o.total) : 0), 0);
    const entregues  = orders.filter(o => o.status === "delivered").length;

    embed.addFields(
      { name: `${ICONS.money} Total gasto`,  value: formatBRL(totalGasto),  inline: true },
      { name: "✅ Entregues",                value: String(entregues),       inline: true },
      { name: `${ICONS.product} Pedidos`,    value: String(orders.length),   inline: true },
    );

    embed.addFields({ name: "\u200b", value: "─────────────────────", inline: false });

    for (const order of orders.slice(0, 8)) {
      const emoji = STATUS_EMOJI[order.status] || "❓";
      const st    = STATUS_PT[order.status]    || order.status;
      const date  = order.created_at ? new Date(order.created_at).toLocaleDateString("pt-BR") : "—";
      const items = order.items?.map(i => i.product_name || "Produto").join(", ") || "—";

      embed.addFields({
        name:   `${emoji} Pedido \`#${shortId(order.id)}\` — ${st}`,
        value:  `📦 ${items}\n${ICONS.money} **${formatBRL(order.total)}** · 📅 ${date}`,
        inline: false,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Ver tudo no painel")
        .setStyle(ButtonStyle.Link)
        .setURL(BRAND.panel)
        .setEmoji("🖥️")
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
