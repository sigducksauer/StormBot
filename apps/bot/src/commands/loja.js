/**
 * apps/bot/src/commands/loja.js
 * Comando /loja V2 — vitrine com paginação e busca
 */
const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, StringSelectMenuBuilder, ComponentType,
} = require("discord.js");
const api = require("../utils/api");
const { buildStoreEmbed, buildProductEmbed } = require("../embeds/store");
const { buildErrorEmbed } = require("../embeds/checkout");
const { ICONS } = require("../embeds/theme");

const PAGE_SIZE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loja")
    .setDescription(`${ICONS.store} Abra a loja e veja os produtos disponíveis`)
    .addIntegerOption(opt =>
      opt.setName("pagina")
        .setDescription("Página de produtos (padrão: 1)")
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const page    = (interaction.options.getInteger("pagina") || 1) - 1;
    const guildId = interaction.guildId;

    let server, products, embedConfig;
    try {
      [server, products, embedConfig] = await Promise.all([
        api.get(`/servers/${guildId}/info`, guildId),
        api.get(`/products?server_discord_id=${guildId}&active=true&limit=100`, guildId),
        api.get(`/embeds/${guildId}/loja`, guildId).catch(() => ({})),
      ]);
    } catch {
      return interaction.editReply({
        embeds: [buildErrorEmbed(
          "Bot não configurado neste servidor.",
          "Acesse o painel para configurar sua loja."
        )],
      });
    }

    const allProducts = Array.isArray(products) ? products : (products?.products ?? []);

    if (!allProducts.length) {
      return interaction.editReply({
        embeds: [buildErrorEmbed("Nenhum produto disponível no momento.", "Volte mais tarde!")],
      });
    }

    const totalPages  = Math.ceil(allProducts.length / PAGE_SIZE);
    const currentPage = Math.min(page, totalPages - 1);
    const pageItems   = allProducts.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    await showStorePage(interaction, pageItems, allProducts, embedConfig, server, currentPage, totalPages);
  },
};

async function showStorePage(interaction, products, allProducts, embedConfig, server, page, totalPages) {
  const embed = buildStoreEmbed(embedConfig, products, server);

  // Select de produtos (máx 25)
  const selectOptions = products.slice(0, 25).map(p => ({
    label:       p.name.slice(0, 100),
    description: `${p.stock === 0 ? "Esgotado — " : ""}${Number(p.price).toFixed(2).replace(".", ",")} R$`.slice(0, 100),
    value:       p.id,
    emoji:       p.stock === 0 ? "🔴" : "🟢",
  }));

  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("select_product")
        .setPlaceholder(`${ICONS.store} Selecione um produto...`)
        .addOptions(selectOptions)
    ),
  ];

  // Paginação
  if (totalPages > 1) {
    const navRow = new ActionRowBuilder();
    if (page > 0) {
      navRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`store_page_${page - 1}`)
          .setLabel("← Anterior")
          .setStyle(ButtonStyle.Secondary)
      );
    }
    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId("store_page_info")
        .setLabel(`Página ${page + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    if (page < totalPages - 1) {
      navRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`store_page_${page + 1}`)
          .setLabel("Próxima →")
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(navRow);
  }

  const msg = await (interaction.replied || interaction.deferred
    ? interaction.editReply({ embeds: [embed], components: rows })
    : interaction.reply({ embeds: [embed], components: rows, ephemeral: true })
  );

  const collector = msg.createMessageComponentCollector({
    time: 5 * 60 * 1000,
    filter: i => i.user.id === interaction.user.id,
  });

  collector.on("collect", async (i) => {
    // Selecionou produto
    if (i.isStringSelectMenu() && i.customId === "select_product") {
      const productId = i.values[0];
      const product   = allProducts.find(p => p.id === productId);
      if (!product) return;

      if (product.stock === 0) {
        return i.reply({ embeds: [buildErrorEmbed("Produto sem estoque.")], ephemeral: true });
      }

      const productEmbed = buildProductEmbed(embedConfig, product);
      const buyRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_${product.id}`)
          .setLabel(`Comprar — ${Number(product.price).toFixed(2).replace(".", ",")} R$`)
          .setStyle(ButtonStyle.Success)
          .setEmoji(ICONS.cart),
        new ButtonBuilder()
          .setCustomId("back_to_store")
          .setLabel("Voltar à Loja")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("◀️")
      );

      await i.update({ embeds: [productEmbed], components: [buyRow] });
      collector.stop();
      return;
    }

    // Paginação
    if (i.isButton() && i.customId.startsWith("store_page_")) {
      const newPage     = parseInt(i.customId.replace("store_page_", ""));
      const newItems    = allProducts.slice(newPage * PAGE_SIZE, (newPage + 1) * PAGE_SIZE);
      await i.deferUpdate();
      collector.stop();
      await showStorePage(i, newItems, allProducts, embedConfig, null, newPage, totalPages);
      return;
    }

    // Voltar à loja
    if (i.isButton() && i.customId === "back_to_store") {
      const pageItems = allProducts.slice(0, PAGE_SIZE);
      await i.deferUpdate();
      collector.stop();
      await showStorePage(i, pageItems, allProducts, embedConfig, null, 0, totalPages);
    }
  });

  collector.on("end", async () => {
    try {
      await msg.edit({ components: [] });
    } catch {}
  });
}
