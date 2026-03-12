/**
 * apps/bot/src/events/interactionCreate.js
 * Roteador central de interações V2
 */
const { startCheckout } = require("../commands/checkout");
const { buildErrorEmbed } = require("../embeds/checkout");

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {
    // ── Slash commands ───────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`❌ Erro em /${interaction.commandName}:`, err);
        const payload = {
          embeds: [buildErrorEmbed(
            "Ocorreu um erro ao executar este comando.",
            "Tente novamente. Se o problema persistir, contate o suporte."
          )],
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    // ── Botões ───────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith("buy_")) {
        await startCheckout(interaction, id.replace("buy_", ""));
        return;
      }

      if (id.startsWith("cancel_order_")) {
        await handleCancelOrder(interaction, id.replace("cancel_order_", ""));
        return;
      }

      if (id === "cancel_checkout") {
        await interaction.update({
          embeds: [buildErrorEmbed("Compra cancelada.", "Use /loja para recomeçar quando quiser.")],
          components: [],
        }).catch(() => {});
        return;
      }

      // back_to_store e store_page_* são tratados nos collectors do loja.js
      return;
    }

    // StringSelect e Modal — tratados pelos collectors internos
    if (interaction.isStringSelectMenu()) return;
    if (interaction.isModalSubmit())      return;
  },
};

async function handleCancelOrder(interaction, orderId) {
  const api = require("../utils/api");
  try {
    await interaction.update({
      embeds: [buildErrorEmbed("Cancelando pedido...")],
      components: [],
    });
    await api.post(`/orders/${orderId}/cancel`, {}, interaction.guildId).catch(() => {});
    await interaction.editReply({
      embeds: [buildErrorEmbed("Pedido cancelado.", "Nenhuma cobrança foi realizada.")],
      components: [],
    });
  } catch (err) {
    console.error("Erro ao cancelar pedido:", err);
  }
}
