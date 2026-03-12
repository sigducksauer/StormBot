/**
 * apps/bot/src/commands/help.js
 * Comando /help — guia completo e interativo de todos os comandos
 */
const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require("discord.js");
const { COLORS, ICONS, BRAND } = require("../embeds/theme");

// ── Seções de ajuda ───────────────────────────────────────
const SECTIONS = {
  overview: {
    label: "Visão Geral",
    emoji: "📖",
    description: "O que é e como funciona o Storm Bots",
    build: (isMod) => new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle("📖 Storm Bots — Guia de Uso")
      .setDescription(
        `O **Storm Bots** é um sistema completo de vendas para Discord.\n` +
        `Venda produtos digitais, chaves, cargos e muito mais diretamente pelo servidor.\n\n` +
        `**Como funciona:**\n` +
        `**1.** O administrador configura produtos e gateways no painel web\n` +
        `**2.** Clientes usam \`/loja\` para ver e comprar produtos\n` +
        `**3.** O pagamento é processado automaticamente\n` +
        `**4.** A entrega (chave, cargo, arquivo) acontece instantaneamente por DM\n\n` +
        `Use os botões abaixo para ver os comandos disponíveis.`
      )
      .addFields(
        { name: "🛒 Comando principal", value: "`/loja` — abre a vitrine de produtos",         inline: false },
        { name: "📋 Seus pedidos",      value: "`/meus-pedidos` — veja seu histórico",          inline: false },
        { name: "❓ Esta ajuda",        value: "`/help` — guia completo de comandos",           inline: false },
        ...(isMod ? [{ name: "⚙️ Administração", value: "`/admin` — painel e relatórios (requer permissão)", inline: false }] : []),
      )
      .setFooter({ text: `${BRAND.footer} · Use os botões para navegar` })
      .setTimestamp(),
  },

  loja: {
    label: "Loja",
    emoji: ICONS.store,
    description: "Como usar a vitrine de produtos",
    build: () => new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle(`${ICONS.store} Comando: /loja`)
      .setDescription("Abre a vitrine de produtos do servidor. Qualquer membro pode usar.")
      .addFields(
        {
          name: "📌 Como usar",
          value:
            "`/loja` — Abre a loja com todos os produtos disponíveis\n" +
            "`/loja pagina:2` — Vai direto para a página 2 (quando há muitos produtos)",
          inline: false,
        },
        {
          name: "🔄 Fluxo de compra",
          value:
            "**1.** Use `/loja` para ver os produtos\n" +
            "**2.** Selecione um produto no menu\n" +
            "**3.** Clique em **Comprar**\n" +
            "**4.** Escolha a forma de pagamento\n" +
            "**5.** Efetue o pagamento (Pix, cartão etc.)\n" +
            "**6.** Receba a entrega automaticamente por DM",
          inline: false,
        },
        {
          name: `${ICONS.pix} Formas de pagamento`,
          value:
            "• **Pix** (Mercado Pago) — aprovação instantânea\n" +
            "• **Cartão de Crédito** — via Mercado Pago ou Stripe\n" +
            "• **Pix Manual** — confirmação pelo vendedor\n" +
            "• **Cartão Internacional** — via Stripe",
          inline: false,
        },
        {
          name: `${ICONS.product} Tipos de produto`,
          value:
            `${ICONS.key} **Chave/Serial** — entregue por DM\n` +
            `${ICONS.role} **Cargo Discord** — concedido automaticamente\n` +
            `📄 **Arquivo digital** — enviado por DM\n` +
            `📺 **Acesso a canal** — liberado automaticamente`,
          inline: false,
        },
        {
          name: "⚠️ Observações",
          value:
            "• A loja só aparece se o servidor tiver produtos cadastrados\n" +
            "• Produtos com 🔴 estão sem estoque\n" +
            "• O tempo para pagamento Pix é de **15 minutos**\n" +
            "• Em caso de problemas, use `/help` → Suporte",
          inline: false,
        },
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp(),
  },

  pedidos: {
    label: "Meus Pedidos",
    emoji: "📋",
    description: "Histórico de compras",
    build: () => new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle("📋 Comando: /meus-pedidos")
      .setDescription("Exibe seu histórico de pedidos neste servidor. Apenas você vê suas informações.")
      .addFields(
        {
          name: "📌 Como usar",
          value: "`/meus-pedidos` — lista seus últimos 10 pedidos neste servidor",
          inline: false,
        },
        {
          name: "🔖 Status dos pedidos",
          value:
            "🟡 **Pendente** — aguardando pagamento\n" +
            "💚 **Pago** — pagamento confirmado\n" +
            "✅ **Entregue** — produto entregue\n" +
            "🔵 **Reembolsado** — valor devolvido\n" +
            "⚫ **Expirado** — tempo esgotado sem pagamento\n" +
            "❌ **Falhou** — erro no processamento",
          inline: false,
        },
        {
          name: "❓ Não recebeu a entrega?",
          value:
            "1. Verifique suas DMs (mensagens diretas)\n" +
            "2. Certifique-se de que permite DMs de membros do servidor\n" +
            "3. Verifique se o pedido está como **Entregue**\n" +
            "4. Se o problema persistir, entre em contato com o suporte",
          inline: false,
        },
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp(),
  },

  admin: {
    label: "Administração",
    emoji: ICONS.gear,
    description: "Comandos para administradores",
    modOnly: true,
    build: () => new EmbedBuilder()
      .setColor(COLORS.warning)
      .setTitle(`${ICONS.gear} Comando: /admin`)
      .setDescription(
        "Comandos de administração. Requer permissão **Gerenciar Servidor**."
      )
      .addFields(
        {
          name: "🖥️ /admin painel",
          value: "Abre o link do painel web de controle do Storm Bots.\nNo painel você gerencia tudo: produtos, pagamentos, embeds, equipe e analytics.",
          inline: false,
        },
        {
          name: "📦 /admin pedidos [status]",
          value:
            "Lista os pedidos recentes do servidor.\n" +
            "Filtros: `pendentes` · `pagos` · `entregues` · `expirados` · `reembolsados`",
          inline: false,
        },
        {
          name: "📊 /admin relatorio [periodo]",
          value:
            "Exibe resumo de vendas com métricas principais.\n" +
            "Períodos: `hoje` · `7 dias` · `30 dias` · `90 dias`",
          inline: false,
        },
        {
          name: "📦 /admin produto [acao]",
          value:
            "Gerencia produtos rapidamente via Discord.\n" +
            "Ações: `listar` — lista todos os produtos · `estoque` — ver estoques",
          inline: false,
        },
        {
          name: "👤 /admin cliente [discord_id]",
          value: "Busca informações de um cliente: histórico, total gasto, status.",
          inline: false,
        },
        {
          name: "🎟️ /admin cupom",
          value: "Lista os cupons de desconto ativos no servidor.",
          inline: false,
        },
        {
          name: "💡 Dica",
          value: "Para gestão completa — produtos, gateways, embeds, automações e relatórios detalhados — acesse o painel web com `/admin painel`.",
          inline: false,
        },
      )
      .setFooter({ text: `${BRAND.footer} · Apenas para administradores` })
      .setTimestamp(),
  },

  faq: {
    label: "FAQ",
    emoji: "❓",
    description: "Perguntas frequentes",
    build: () => new EmbedBuilder()
      .setColor(COLORS.neutral)
      .setTitle("❓ Perguntas Frequentes")
      .addFields(
        {
          name: "Não recebi meu produto após pagar. O que faço?",
          value:
            "1. Verifique se suas DMs estão abertas (Configurações → Privacidade → Mensagens diretas de membros do servidor = ON)\n" +
            "2. Verifique `/meus-pedidos` se o status está como **Entregue**\n" +
            "3. Se pago mas não entregue, aguarde alguns minutos e contate o suporte",
          inline: false,
        },
        {
          name: "Meu Pix expirou. Perdi o dinheiro?",
          value:
            "Não. Se o QR Code expirou **antes** de você pagar, nenhum valor foi cobrado.\n" +
            "Se você pagou e o pedido expirou, entre em contato com o vendedor.",
          inline: false,
        },
        {
          name: "Posso comprar novamente o mesmo produto?",
          value: "Sim! Basta usar `/loja` e comprar novamente.",
          inline: false,
        },
        {
          name: "Comprei um cargo mas ele sumiu. Por quê?",
          value: "Alguns cargos têm prazo de validade. Quando expira, ele é removido automaticamente. Verifique seus pedidos para ver a data de expiração.",
          inline: false,
        },
        {
          name: "O bot não responde. O que fazer?",
          value:
            "1. Verifique se o bot está online (ponto verde no perfil)\n" +
            "2. Tente novamente em alguns minutos\n" +
            "3. Se o problema persistir, contate o suporte do servidor",
          inline: false,
        },
      )
      .setFooter({ text: `${BRAND.footer} · Mais dúvidas? Use o suporte` })
      .setTimestamp(),
  },

  support: {
    label: "Suporte",
    emoji: "💬",
    description: "Como obter ajuda",
    build: () => new EmbedBuilder()
      .setColor(COLORS.success)
      .setTitle("💬 Suporte Storm Bots")
      .setDescription(
        "Para suporte técnico, acesse nossos canais oficiais.\n\n" +
        "⚠️ **Atenção**: O suporte Storm Bots cuida apenas do **funcionamento do bot**.\n" +
        "Para problemas com pedidos específicos, contate o **vendedor do servidor**."
      )
      .addFields(
        { name: "🌐 Painel Web",    value: `[stormbots.com.br](${BRAND.panel})`,    inline: true },
        { name: "💬 Discord",       value: `[Servidor de Suporte](${BRAND.support})`, inline: true },
        { name: "⏰ Atendimento",   value: "24/7 via Discord",                        inline: true },
        {
          name: "📋 Antes de abrir ticket, informe:",
          value:
            "• Qual comando você usou\n" +
            "• O erro exato que apareceu (print se possível)\n" +
            "• ID do pedido (se aplicável) — veja em `/meus-pedidos`",
          inline: false,
        },
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp(),
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("📖 Guia completo de todos os comandos do Storm Bots"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const isMod = interaction.member?.permissions?.has?.("ManageGuild") ?? false;

    // Embed inicial
    const embed = SECTIONS.overview.build(isMod);

    // Botões de navegação
    function buildRows(current) {
      const buttons = Object.entries(SECTIONS)
        .filter(([, s]) => !s.modOnly || isMod)
        .map(([key, s]) =>
          new ButtonBuilder()
            .setCustomId(`help_${key}`)
            .setLabel(s.label)
            .setEmoji(s.emoji)
            .setStyle(key === current ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(key === current)
        );

      // Linha 1 — máx 5 botões
      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      }
      return rows;
    }

    const msg = await interaction.editReply({
      embeds: [embed],
      components: buildRows("overview"),
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: i => i.user.id === interaction.user.id && i.customId.startsWith("help_"),
      time: 10 * 60 * 1000,
    });

    collector.on("collect", async (btn) => {
      const key = btn.customId.replace("help_", "");
      const section = SECTIONS[key];
      if (!section) return;

      // Verifica permissão para seção admin
      if (section.modOnly && !isMod) {
        return btn.reply({ content: "❌ Você não tem permissão para ver esta seção.", ephemeral: true });
      }

      await btn.update({
        embeds: [section.build(isMod)],
        components: buildRows(key),
      });
    });

    collector.on("end", async () => {
      try {
        await msg.edit({ components: [] });
      } catch {}
    });
  },
};
