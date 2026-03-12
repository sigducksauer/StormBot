/**
 * apps/bot/src/embeds/checkout.js
 * Embeds V2 — Checkout, Pix, Sucesso, Erro, DM de entrega
 */
const { EmbedBuilder } = require("discord.js");
const { COLORS, ICONS, BRAND, parseColor, interpolate, formatBRL, formatDate, shortId } = require("./theme");

// ── Embed de checkout (seleção de pagamento) ──────────────
function buildCheckoutEmbed(config = {}, product = {}) {
  const color = parseColor(config.color, COLORS.primary);
  const vars  = { produto: product.name, preco: formatBRL(product.price) };

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(interpolate(config.checkout_title || `${ICONS.cart} Finalizar Compra`, vars))
    .setDescription(
      interpolate(
        config.checkout_description ||
        `Você está adquirindo **{produto}**.\nEscolha a forma de pagamento abaixo para continuar.`,
        vars
      )
    )
    .addFields(
      { name: `${ICONS.product} Produto`, value: `\`\`${product.name}\`\``,           inline: true },
      { name: `${ICONS.money} Valor`,     value: `**${formatBRL(product.price)}**`,    inline: true },
      { name: `${ICONS.lock} Segurança`,  value: "Compra 100% segura",                 inline: true },
    );

  if (product.image_url || config.thumbnail_url) {
    embed.setThumbnail(product.image_url || config.thumbnail_url);
  }

  embed
    .setFooter({ text: `${BRAND.footer} · Sua compra é protegida` })
    .setTimestamp();

  return embed;
}

// ── Embed de pagamento Pix ────────────────────────────────
async function buildPixEmbed(config = {}, order = {}, product = {}) {
  const expiresAt  = order.expires_at ? new Date(order.expires_at) : new Date(Date.now() + 15 * 60 * 1000);
  const expiresStr = expiresAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const pixCode    = order.pix_code || order.metadata?.pix_code || null;

  const embed = new EmbedBuilder()
    .setColor(COLORS.pix)
    .setTitle(`${ICONS.pix} Pague via Pix`)
    .setDescription(
      `Pague **${formatBRL(order.total)}** e receba entrega automática.\n` +
      `\n${ICONS.timer} Expira às **${expiresStr}** — não feche esta janela.`
    )
    .addFields(
      { name: `${ICONS.product} Produto`, value: product.name || "—",              inline: true },
      { name: `${ICONS.money} Valor`,     value: formatBRL(order.total),            inline: true },
      { name: "🔖 Pedido",                value: `\`#${shortId(order.id)}\``,       inline: true },
    );

  if (pixCode) {
    // Quebra o código em bloco para fácil cópia
    embed.addFields({
      name:  "📋 Código Pix — Copia e Cola",
      value: `\`\`\`\n${pixCode}\n\`\`\``,
      inline: false,
    });
  }

  embed
    .setFooter({ text: `${BRAND.footer} · Confirmação automática após pagamento` })
    .setTimestamp();

  return embed;
}

// ── Embed aguardando confirmação ──────────────────────────
function buildWaitingEmbed(order = {}, product = {}) {
  return new EmbedBuilder()
    .setColor(COLORS.warning)
    .setTitle(`${ICONS.timer} Aguardando Pagamento`)
    .setDescription(
      `Estamos aguardando a confirmação do seu pagamento.\n\n` +
      `Assim que o pagamento for processado, você receberá a entrega **automaticamente** neste chat.`
    )
    .addFields(
      { name: "🔖 Pedido",            value: `\`#${shortId(order.id)}\``,    inline: true },
      { name: `${ICONS.money} Valor`, value: formatBRL(order.total),          inline: true },
    )
    .setFooter({ text: `${BRAND.footer} · Não feche esta janela` })
    .setTimestamp();
}

// ── Embed de compra confirmada ────────────────────────────
function buildSuccessEmbed(config = {}, order = {}, product = {}) {
  const vars = {
    produto: product.name,
    preco:   formatBRL(order.total),
    pedido:  shortId(order.id),
  };

  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(interpolate(config.success_title || `${ICONS.success} Pagamento Confirmado!`, vars))
    .setDescription(
      interpolate(
        config.success_description ||
        `Seu pagamento foi aprovado! ${ICONS.star}\n\n**{produto}** foi entregue na sua DM.\nPedido: \`#{pedido}\``,
        vars
      )
    )
    .addFields(
      { name: `${ICONS.product} Produto`, value: product.name || "—",       inline: true },
      { name: `${ICONS.money} Valor`,     value: formatBRL(order.total),     inline: true },
      { name: "🔖 Pedido",                value: `\`#${shortId(order.id)}\``, inline: true },
    )
    .setThumbnail(product.image_url || config.thumbnail_url || null)
    .setFooter({ text: `${BRAND.footer} · Obrigado pela sua compra!` })
    .setTimestamp();
}

// ── Embed de erro ─────────────────────────────────────────
function buildErrorEmbed(message = "Erro desconhecido.", hint = null) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.danger)
    .setTitle(`${ICONS.error} Algo deu errado`)
    .setDescription(message)
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  if (hint) {
    embed.addFields({ name: `${ICONS.info} Dica`, value: hint, inline: false });
  }

  return embed;
}

// ── DM: Chave/Serial entregue ─────────────────────────────
function buildDmKeyEmbed(product, keyValue, orderId) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`${ICONS.key} Sua chave foi entregue!`)
    .setDescription(
      `Obrigado por comprar **${product.name}**!\nGuarde sua chave em local seguro.`
    )
    .addFields(
      {
        name:   `${ICONS.key} Chave / Serial`,
        value:  `\`\`\`\n${keyValue}\n\`\`\``,
        inline: false,
      },
      { name: "🔖 Pedido", value: `\`#${shortId(orderId)}\``, inline: true },
      { name: `${ICONS.info} Suporte`, value: `[Clique aqui](${BRAND.support})`, inline: true },
    )
    .setFooter({ text: `${BRAND.footer} · Guarde esta chave em local seguro` })
    .setTimestamp();
}

// ── DM: Cargo concedido ───────────────────────────────────
function buildDmRoleEmbed(product, roleName, orderId, expiresAt = null) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle(`${ICONS.role} Cargo concedido!`)
    .setDescription(`Você adquiriu **${product.name}** e o cargo **${roleName}** foi concedido no servidor.`)
    .addFields(
      { name: "🎭 Cargo",  value: `\`${roleName}\``,          inline: true },
      { name: "🔖 Pedido", value: `\`#${shortId(orderId)}\``, inline: true },
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  if (expiresAt) {
    embed.addFields({ name: `${ICONS.timer} Expira em`, value: formatDate(expiresAt), inline: true });
  }

  return embed;
}

// ── DM: Acesso a canal concedido ──────────────────────────
function buildDmChannelEmbed(product, channelName, orderId) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle("📺 Acesso ao canal liberado!")
    .setDescription(`Você adquiriu **${product.name}** e agora tem acesso ao canal **${channelName}**.`)
    .addFields(
      { name: "📺 Canal",  value: `\`${channelName}\``,        inline: true },
      { name: "🔖 Pedido", value: `\`#${shortId(orderId)}\``, inline: true },
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp();
}

// ── DM: Arquivo digital entregue ─────────────────────────
function buildDmFileEmbed(product, orderId) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle("📄 Arquivo entregue!")
    .setDescription(`Seu arquivo digital de **${product.name}** está anexado a esta mensagem.`)
    .addFields({ name: "🔖 Pedido", value: `\`#${shortId(orderId)}\``, inline: true })
    .setFooter({ text: `${BRAND.footer} · Não compartilhe este arquivo` })
    .setTimestamp();
}

// ── Embed de pagamento por link (Stripe/MP Cartão) ────────
function buildLinkPaymentEmbed(order = {}, product = {}, gatewayName = "Gateway", color = COLORS.primary) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${ICONS.card} Pagamento — ${gatewayName}`)
    .setDescription(
      `Clique no botão abaixo para pagar **${formatBRL(order.total)}**.\n\n` +
      `Você receberá a entrega automaticamente por DM após a confirmação.\n` +
      `${ICONS.timer} O link expira em **15 minutos**.`
    )
    .addFields(
      { name: `${ICONS.product} Produto`, value: product.name || "—",        inline: true },
      { name: `${ICONS.money} Valor`,     value: formatBRL(order.total),      inline: true },
      { name: "🔖 Pedido",                value: `\`#${shortId(order.id)}\``, inline: true },
    )
    .setFooter({ text: `${BRAND.footer} · Pagamento processado por ${gatewayName}` })
    .setTimestamp();
}

module.exports = {
  buildCheckoutEmbed,
  buildPixEmbed,
  buildWaitingEmbed,
  buildSuccessEmbed,
  buildErrorEmbed,
  buildDmKeyEmbed,
  buildDmRoleEmbed,
  buildDmChannelEmbed,
  buildDmFileEmbed,
  buildLinkPaymentEmbed,
};
