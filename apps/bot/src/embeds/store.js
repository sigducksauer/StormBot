/**
 * apps/bot/src/embeds/store.js
 * Embeds V2 — Loja e Produto
 */
const { EmbedBuilder } = require("discord.js");
const { COLORS, ICONS, BRAND, parseColor, interpolate, formatBRL, shortId } = require("./theme");

function buildStoreEmbed(config = {}, products = [], server = {}) {
  const vars = {
    servidor:       server.name || "Loja",
    data:           new Date().toLocaleDateString("pt-BR"),
    total_produtos: products.length,
  };

  const color = parseColor(config.color, COLORS.primary);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(interpolate(config.title || `${ICONS.store} ${server.name || "Loja"}`, vars))
    .setDescription(
      interpolate(
        config.description || `Bem-vindo! Selecione um produto abaixo para comprar.\n\n**${products.length}** produto(s) disponível(is).`,
        vars
      )
    );

  if (config.thumbnail_url) embed.setThumbnail(config.thumbnail_url);
  if (config.image_url)     embed.setImage(config.image_url);

  if (config.author_name) {
    embed.setAuthor({
      name:    interpolate(config.author_name, vars),
      iconURL: config.author_icon || undefined,
    });
  }

  // Lista de produtos com visual limpo
  if (products.length) {
    const lines = products.slice(0, 10).map(p => {
      const stock  = p.stock === -1 ? "∞" : p.stock === 0 ? "Esgotado" : `${p.stock}`;
      const status = p.stock === 0 ? ICONS.dot_off : ICONS.dot_on;
      const price  = formatBRL(p.price);
      const badge  = p.original_price && p.original_price > p.price
        ? ` ~~${formatBRL(p.original_price)}~~`
        : "";
      return `${status} **${p.name}**${badge}\n↳ ${price} · Estoque: \`${stock}\``;
    });
    embed.addFields({ name: `${ICONS.product} Produtos`, value: lines.join("\n\n"), inline: false });
  }

  // Campos extras configurados
  if (config.fields?.length) {
    for (const field of config.fields.slice(0, 3)) {
      embed.addFields({
        name:   interpolate(field.name, vars),
        value:  interpolate(field.value, vars),
        inline: field.inline ?? false,
      });
    }
  }

  embed.setFooter({
    text: config.footer_text
      ? interpolate(config.footer_text, vars)
      : `${BRAND.footer} · Use o menu abaixo para comprar`,
    iconURL: config.footer_icon || undefined,
  });

  embed.setTimestamp();
  return embed;
}

function buildProductEmbed(config = {}, product = {}) {
  const color = parseColor(config.color, COLORS.primary);
  const hasDiscount = product.original_price && product.original_price > product.price;
  const discount = hasDiscount
    ? Math.round((1 - product.price / product.original_price) * 100)
    : 0;

  const vars = {
    produto:  product.name,
    preco:    formatBRL(product.price),
    descricao: product.description || "",
    estoque:  product.stock === -1 ? "Ilimitado" : String(product.stock),
  };

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(interpolate(config.product_title || `${ICONS.product} ${product.name}`, vars));

  // Descrição rica
  let desc = product.description ? `${product.description}\n\n` : "";
  if (hasDiscount) {
    desc += `${ICONS.fire} **OFERTA** — ~~${formatBRL(product.original_price)}~~ → **${formatBRL(product.price)}** (-${discount}%)\n`;
  }
  embed.setDescription(desc || `Clique em **Comprar** para adquirir este produto.`);

  if (product.image_url) embed.setImage(product.image_url);
  else if (config.thumbnail_url) embed.setThumbnail(config.thumbnail_url);

  const stockDisplay = product.stock === -1
    ? "∞ Ilimitado"
    : product.stock === 0
    ? `${ICONS.dot_off} Esgotado`
    : `${ICONS.dot_on} ${product.stock} unid.`;

  const typeLabels = {
    key:          `${ICONS.key} Chave/Serial`,
    digital:      "📄 Digital",
    role:         `${ICONS.role} Cargo Discord`,
    channel:      "📺 Canal Discord",
    subscription: "🔄 Assinatura",
    physical:     "📬 Físico",
    service:      "🛠️ Serviço",
    license:      "📃 Licença",
  };

  embed.addFields(
    { name: `${ICONS.money} Preço`,   value: formatBRL(product.price),                          inline: true },
    { name: `${ICONS.product} Estoque`, value: stockDisplay,                                    inline: true },
    { name: "🏷️ Tipo",                  value: typeLabels[product.product_type] || product.product_type || "—", inline: true },
  );

  // Variantes disponíveis
  if (product.variants?.length) {
    const variantLines = product.variants
      .filter(v => v.is_active)
      .map(v => `• **${v.name}** — ${formatBRL(v.price_modifier ? product.price + v.price_modifier : product.price)}`)
      .join("\n");
    if (variantLines) embed.addFields({ name: "📋 Variantes", value: variantLines, inline: false });
  }

  embed.setFooter({ text: `${BRAND.footer} · ID: ${shortId(product.id)}` });
  embed.setTimestamp();
  return embed;
}

module.exports = { buildStoreEmbed, buildProductEmbed, interpolate, parseColor };
