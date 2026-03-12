/**
 * apps/bot/src/events/guildCreate.js
 * Registra servidor e envia boas-vindas V2
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const api = require("../utils/api");
const { COLORS, ICONS, BRAND } = require("../embeds/theme");

module.exports = {
  name: "guildCreate",

  async execute(guild, client) {
    console.log(`\n🎉 Bot adicionado: ${guild.name} (${guild.id}) — ${guild.memberCount} membros`);

    try {
      const owner = await guild.fetchOwner().catch(() => null);
      await api.postInternal("/servers/register", {
        guild_id:   guild.id,
        guild_name: guild.name,
        guild_icon: guild.icon
          ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
          : null,
        owner_id:    owner?.id ?? null,
        member_count: guild.memberCount,
      });
      console.log(`✅ Servidor ${guild.name} registrado.`);
    } catch (err) {
      console.error(`❌ Erro ao registrar ${guild.name}:`, err.message);
    }

    const ch = guild.systemChannel;
    if (!ch?.permissionsFor(guild.members.me)?.has("SendMessages")) return;

    try {
      const embed = new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle(`${ICONS.store} Storm Bots instalado com sucesso!`)
        .setDescription(
          `Olá **${guild.name}**! Estou pronto para transformar seu servidor em uma loja.\n\n` +
          `**Para começar em 3 passos:**`
        )
        .addFields(
          { name: "1️⃣ Acesse o Painel",             value: "Faça login com Discord e selecione este servidor.", inline: false },
          { name: "2️⃣ Configure o pagamento",       value: "Adicione seu Mercado Pago, Stripe ou Pix Manual.", inline: false },
          { name: "3️⃣ Crie seus produtos",          value: `Use \`/loja\` em qualquer canal para exibir a vitrine.`, inline: false },
        )
        .setFooter({ text: `${BRAND.footer} · Suporte disponível 24h` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Acessar Painel").setStyle(ButtonStyle.Link).setURL(BRAND.panel).setEmoji("🖥️"),
        new ButtonBuilder().setLabel("Suporte").setStyle(ButtonStyle.Link).setURL(BRAND.support).setEmoji("💬"),
      );

      await ch.send({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error("Boas-vindas não enviadas:", err.message);
    }
  },
};
